/**
 * AiEngine unit tests
 * Run: node tests/ai-engine.test.mjs
 */

import { AiEngine } from '../js/ai-engine.js';
import { strict as assert } from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';

// Mock fetch globally
let lastRequestBody = null;

function mockFetch() {
    global.fetch = async (_url, options) => {
        lastRequestBody = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Bot reply' } }]
            })
        };
    };
}

function createEngine(overrides = {}) {
    return new AiEngine({
        characterId: 'char1',
        characterName: 'Alice',
        systemPrompt: 'You are Alice',
        provider: 'openai',
        model: 'gpt-4.1-nano',
        apiKey: 'sk-test',
        globalSettings: {},
        ...overrides
    });
}

describe('AiEngine', () => {
    beforeEach(() => {
        lastRequestBody = null;
        mockFetch();
    });

    describe('sendMessage - no duplicate user messages', () => {
        it('should send user message exactly once', async () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hello!', isPlayer: true });

            await engine.sendMessage('Hello!');

            const userMessages = lastRequestBody.messages.filter(
                m => m.role === 'user' && m.content === 'Hello!'
            );
            assert.equal(userMessages.length, 1,
                `Expected 1 user message, got ${userMessages.length}`);
        });

        it('should not duplicate after multiple exchanges', async () => {
            const engine = createEngine();

            // First exchange
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            await engine.sendMessage('Hi');
            engine.addMessage({ speaker: 'char1', text: 'Bot reply', isPlayer: false });

            // Second exchange
            engine.addMessage({ speaker: 'player', text: 'How are you?', isPlayer: true });
            await engine.sendMessage('How are you?');

            const howAreYou = lastRequestBody.messages.filter(
                m => m.role === 'user' && m.content === 'How are you?'
            );
            assert.equal(howAreYou.length, 1);
            assert.equal(lastRequestBody.messages.length, 4); // system + Hi + Bot reply + How are you?
        });
    });

    describe('sendMessage - message structure', () => {
        it('should always start with system prompt', async () => {
            const engine = createEngine({ systemPrompt: 'Test prompt' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            assert.equal(lastRequestBody.messages[0].role, 'system');
            assert.equal(lastRequestBody.messages[0].content, 'Test prompt');
        });

        it('should map player messages to user role and NPC to assistant', async () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hello', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Bye', isPlayer: true });

            await engine.sendMessage('Bye');

            const roles = lastRequestBody.messages.map(m => m.role);
            assert.deepEqual(roles, ['system', 'user', 'assistant', 'user']);
        });

        it('should send correct model and endpoint', async () => {
            let capturedUrl = null;
            global.fetch = async (url, options) => {
                capturedUrl = url;
                lastRequestBody = JSON.parse(options.body);
                return { ok: true, json: async () => ({ choices: [{ message: { content: '' } }] }) };
            };

            const engine = createEngine({ provider: 'grok', model: 'grok-3-mini' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            await engine.sendMessage('Hi');

            assert.equal(capturedUrl, 'https://api.x.ai/v1/chat/completions');
            assert.equal(lastRequestBody.model, 'grok-3-mini');
        });
    });

    describe('sendMessage - context window limit', () => {
        it('should limit history to last 50 messages', async () => {
            const engine = createEngine();

            // Add 60 messages
            for (let i = 0; i < 60; i++) {
                engine.addMessage({
                    speaker: i % 2 === 0 ? 'player' : 'char1',
                    text: `msg-${i}`,
                    isPlayer: i % 2 === 0
                });
            }

            await engine.sendMessage('msg-59');

            // system + last 50 messages = 51
            assert.equal(lastRequestBody.messages.length, 51);
            assert.equal(lastRequestBody.messages[0].role, 'system');
            // First history message should be msg-10 (skipping 0-9)
            assert.equal(lastRequestBody.messages[1].content, 'msg-10');
        });
    });

    describe('sendMessage - error handling', () => {
        it('should throw on 401', async () => {
            global.fetch = async () => ({ ok: false, status: 401, text: async () => '' });
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await assert.rejects(() => engine.sendMessage('Hi'), { message: 'Invalid API key' });
        });

        it('should throw on 429', async () => {
            global.fetch = async () => ({ ok: false, status: 429, text: async () => '' });
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await assert.rejects(() => engine.sendMessage('Hi'), { message: 'Rate limit exceeded' });
        });

        it('should throw on unknown provider', async () => {
            const engine = createEngine({ provider: 'unknown' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await assert.rejects(() => engine.sendMessage('Hi'), { message: /Unknown provider/ });
        });
    });

    describe('state management', () => {
        it('should save and restore state', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hello', isPlayer: false });

            const state = engine.getState();
            const engine2 = createEngine();
            engine2.restore(state);

            assert.equal(engine2.displayedMessages.length, 2);
            assert.equal(engine2.displayedMessages[0].text, 'Hi');
        });

        it('should reset messages', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.reset();

            assert.equal(engine.displayedMessages.length, 0);
        });
    });
});
