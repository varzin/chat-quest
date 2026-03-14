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

    describe('sendMessage - token budget context limit', () => {
        it('should limit history by token budget, not fixed message count', async () => {
            // Capture only the first fetch call (main request, not summarization)
            let mainRequestBody = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainRequestBody) mainRequestBody = body;
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: 'Bot reply' } }]
                    })
                };
            };

            const engine = createEngine({
                globalSettings: { historyTokenBudget: 100 }
            });

            // Add many short messages (~2 tokens each: "msg-XX" = ~6 chars = ~1.5 tokens)
            for (let i = 0; i < 60; i++) {
                engine.addMessage({
                    speaker: i % 2 === 0 ? 'player' : 'char1',
                    text: `msg-${i}`,
                    isPlayer: i % 2 === 0
                });
            }

            await engine.sendMessage('msg-59');

            // With budget=100 tokens and ~1.5 tokens/msg, should fit ~60 messages
            assert.equal(mainRequestBody.messages[0].role, 'system');
            // Last message should be the most recent
            const lastMsg = mainRequestBody.messages[mainRequestBody.messages.length - 1];
            assert.equal(lastMsg.content, 'msg-59');
        });

        it('should truncate old messages when budget is small', async () => {
            let mainRequestBody = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainRequestBody) mainRequestBody = body;
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: 'Bot reply' } }]
                    })
                };
            };

            const engine = createEngine({
                globalSettings: { historyTokenBudget: 20 }
            });

            // Add messages with ~10 tokens each (~40 chars)
            for (let i = 0; i < 10; i++) {
                engine.addMessage({
                    speaker: i % 2 === 0 ? 'player' : 'char1',
                    text: `This is a longer message number ${i} with more text`,
                    isPlayer: i % 2 === 0
                });
            }

            await engine.sendMessage('last');

            // Should have fewer than 10 history messages due to budget
            const historyCount = mainRequestBody.messages.length - 1; // minus system
            assert.ok(historyCount < 10,
                `Expected fewer than 10 history messages, got ${historyCount}`);
            assert.ok(historyCount > 0, 'Should have at least 1 history message');
        });
    });

    describe('_estimateTokens', () => {
        it('should estimate ASCII text at ~4 chars per token', () => {
            const engine = createEngine();
            // 40 ASCII chars → ~10 tokens
            const tokens = engine._estimateTokens('a'.repeat(40));
            assert.equal(tokens, 10);
        });

        it('should estimate Cyrillic text at ~2 chars per token', () => {
            const engine = createEngine();
            // 20 Cyrillic chars → ~10 tokens
            const tokens = engine._estimateTokens('а'.repeat(20));
            assert.equal(tokens, 10);
        });

        it('should handle mixed text', () => {
            const engine = createEngine();
            // 8 ASCII + 4 Cyrillic = 8/4 + 4/2 = 2 + 2 = 4
            const tokens = engine._estimateTokens('Hello!!!Привет');
            // "Hello!!!" = 8 ASCII, "Привет" = 6 Cyrillic
            // 8/4 + 6/2 = 2 + 3 = 5
            assert.equal(tokens, 5);
        });
    });

    describe('summary in context', () => {
        it('should include summary as second system message when present', async () => {
            const engine = createEngine();
            engine._summary = 'Player discussed weather with Alice.';
            engine.addMessage({ speaker: 'player', text: 'Hi again', isPlayer: true });

            await engine.sendMessage('Hi again');

            assert.equal(lastRequestBody.messages[0].role, 'system');
            assert.equal(lastRequestBody.messages[0].content, 'You are Alice');
            assert.equal(lastRequestBody.messages[1].role, 'system');
            assert.ok(lastRequestBody.messages[1].content.includes('Player discussed weather'));
            assert.equal(lastRequestBody.messages[2].role, 'user');
            assert.equal(lastRequestBody.messages[2].content, 'Hi again');
        });

        it('should not include summary message when no summary exists', async () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            const systemMessages = lastRequestBody.messages.filter(m => m.role === 'system');
            assert.equal(systemMessages.length, 1);
        });
    });

    describe('state management', () => {
        it('should save and restore state including summary', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hello', isPlayer: false });
            engine._summary = 'Test summary';
            engine._summaryUpToIndex = 5;

            const state = engine.getState();
            const engine2 = createEngine();
            engine2.restore(state);

            assert.equal(engine2.displayedMessages.length, 2);
            assert.equal(engine2.displayedMessages[0].text, 'Hi');
            assert.equal(engine2._summary, 'Test summary');
            assert.equal(engine2._summaryUpToIndex, 5);
        });

        it('should restore without summary gracefully', () => {
            const engine = createEngine();
            engine.restore({ displayedMessages: [{ text: 'Hi', isPlayer: true }] });

            assert.equal(engine._summary, null);
            assert.equal(engine._summaryUpToIndex, 0);
        });

        it('should reset messages and summary', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine._summary = 'Old summary';
            engine._summaryUpToIndex = 10;
            engine.reset();

            assert.equal(engine.displayedMessages.length, 0);
            assert.equal(engine._summary, null);
            assert.equal(engine._summaryUpToIndex, 0);
            assert.equal(engine._isSummarizing, false);
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

    describe('_detectLanguage', () => {
        it('should detect Russian text', () => {
            const engine = createEngine();
            assert.equal(engine._detectLanguage('Привет, как дела?'), 'ru');
        });

        it('should detect English text', () => {
            const engine = createEngine();
            assert.equal(engine._detectLanguage('Hello, how are you?'), 'en');
        });
    });
});
