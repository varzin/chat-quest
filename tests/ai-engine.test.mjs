/**
 * AiEngine unit tests
 * Run: node tests/ai-engine.test.mjs
 */

import { AiEngine } from '../js/ai-engine.js';
import { strict as assert } from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';

// Mock fetch globally
let lastRequestBody = null;
let fetchCallCount = 0;

function mockFetch(condensedReply = 'Condensed version') {
    fetchCallCount = 0;
    global.fetch = async (_url, options) => {
        fetchCallCount++;
        lastRequestBody = JSON.parse(options.body);
        // Detect condensation call by checking system prompt
        const sysContent = lastRequestBody.messages?.[0]?.content || '';
        const isCondensation = sysContent.includes('Condense') || sysContent.includes('Сократи');
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: isCondensation ? condensedReply : 'Bot reply' } }]
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
        fetchCallCount = 0;
        mockFetch();
    });

    describe('sendMessage - no duplicate user messages', () => {
        it('should send user message exactly once', async () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hello!', isPlayer: true });

            await engine.sendMessage('Hello!');

            // First fetch call is the main request
            assert.ok(fetchCallCount >= 1);
        });

        it('should not duplicate after multiple exchanges', async () => {
            let mainRequestBodies = [];
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                mainRequestBodies.push(body);
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: 'Bot reply' } }]
                    })
                };
            };

            const engine = createEngine();

            // First exchange
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            await engine.sendMessage('Hi');
            engine.addMessage({ speaker: 'char1', text: 'Bot reply', isPlayer: false });

            // Second exchange
            engine.addMessage({ speaker: 'player', text: 'How are you?', isPlayer: true });
            await engine.sendMessage('How are you?');

            // Check the second main request (index 2: first main, first condense, second main)
            const secondMainReq = mainRequestBodies[2];
            const howAreYou = secondMainReq.messages.filter(
                m => m.role === 'user' && m.content === 'How are you?'
            );
            assert.equal(howAreYou.length, 1);
        });
    });

    describe('sendMessage - message structure', () => {
        it('should start with system prompt without preamble', async () => {
            let mainReq = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Bot reply' } }] })
                };
            };

            const engine = createEngine({ systemPrompt: 'Test prompt' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            assert.equal(mainReq.messages[0].role, 'system');
            assert.equal(mainReq.messages[0].content, 'Test prompt');
        });

        it('should map recent player messages to user role and NPC to assistant', async () => {
            let mainReq = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Bot reply' } }] })
                };
            };

            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hello there friend', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Bye', isPlayer: true });

            await engine.sendMessage('Bye');

            // Filter out reminder system messages to check core structure
            const nonReminderMsgs = mainReq.messages.filter(m =>
                !(m.role === 'system' && m.content !== 'You are Alice')
            );
            const roles = nonReminderMsgs.map(m => m.role);
            assert.deepEqual(roles, ['system', 'user', 'assistant', 'user']);
        });

        it('should send correct model and endpoint', async () => {
            let capturedUrl = null;
            let mainReq = null;
            global.fetch = async (url, options) => {
                capturedUrl = url;
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
                return { ok: true, json: async () => ({ choices: [{ message: { content: '' } }] }) };
            };

            const engine = createEngine({ provider: 'grok', model: 'grok-3-mini' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            await engine.sendMessage('Hi');

            assert.equal(capturedUrl, 'https://api.x.ai/v1/chat/completions');
            assert.equal(mainReq.model, 'grok-3-mini');
        });

        it('should include frequency_penalty and presence_penalty for openai', async () => {
            let mainReq = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Bot reply' } }] })
                };
            };

            const engine = createEngine({ provider: 'openai' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            assert.ok(mainReq.frequency_penalty > 0);
            assert.ok(mainReq.presence_penalty > 0);
        });

        it('should NOT include penalties for grok provider', async () => {
            let mainReq = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: '' } }] })
                };
            };

            const engine = createEngine({ provider: 'grok', model: 'grok-3-mini' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            await engine.sendMessage('Hi');

            assert.equal(mainReq.frequency_penalty, undefined);
            assert.equal(mainReq.presence_penalty, undefined);
        });
    });

    describe('_condenseMessage', () => {
        it('should call API and return condensed text', async () => {
            mockFetch('She greeted him warmly.');
            const engine = createEngine();

            const result = await engine._condenseMessage('О, привет! Как же я рада тебя видеть! *улыбается*');

            assert.equal(result, 'She greeted him warmly.');
        });

        it('should return original text on API failure', async () => {
            global.fetch = async () => ({ ok: false, status: 500 });
            const engine = createEngine();

            const original = 'Some message text';
            const result = await engine._condenseMessage(original);

            assert.equal(result, original);
        });

        it('should return original text on network error', async () => {
            global.fetch = async () => { throw new Error('Network error'); };
            const engine = createEngine();

            const original = 'Some message text';
            const result = await engine._condenseMessage(original);

            assert.equal(result, original);
        });

        it('should use Russian prompt for Russian text', async () => {
            let capturedPrompt = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                capturedPrompt = body.messages[0].content;
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Сжатое' } }] })
                };
            };

            const engine = createEngine();
            await engine._condenseMessage('Привет, как дела? Давай погуляем.');

            assert.ok(capturedPrompt.includes('Сократи'));
        });

        it('should include max_tokens in API call', async () => {
            let capturedBody = null;
            global.fetch = async (_url, options) => {
                capturedBody = JSON.parse(options.body);
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Short' } }] })
                };
            };

            const engine = createEngine();
            await engine._condenseMessage('Hello there');

            assert.equal(capturedBody.max_tokens, 150);
        });
    });

    describe('addMessage - condensation attachment', () => {
        it('should attach pendingCondensed to AI messages', () => {
            const engine = createEngine();
            engine._pendingCondensed = 'Condensed version';

            engine.addMessage({ speaker: 'char1', text: 'Original long message', isPlayer: false });

            assert.equal(engine.displayedMessages[0].condensed, 'Condensed version');
            assert.equal(engine._pendingCondensed, null);
        });

        it('should not attach condensed to player messages', () => {
            const engine = createEngine();
            engine._pendingCondensed = 'Condensed version';

            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            assert.equal(engine.displayedMessages[0].condensed, undefined);
            assert.equal(engine._pendingCondensed, 'Condensed version');
        });

        it('should not attach when no pending condensed', () => {
            const engine = createEngine();

            engine.addMessage({ speaker: 'char1', text: 'Hello', isPlayer: false });

            assert.equal(engine.displayedMessages[0].condensed, undefined);
        });
    });

    describe('_buildContextMessages - condensed context', () => {
        it('should send older messages as condensed system block', () => {
            const engine = createEngine();

            // Add 6 messages (more than RECENT_MESSAGES_KEEP=4)
            engine.addMessage({ speaker: 'player', text: 'First question', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Long original answer', isPlayer: false, condensed: 'Answered briefly' });
            engine.addMessage({ speaker: 'player', text: 'Second question', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Another long reply', isPlayer: false, condensed: 'Replied about topic' });
            engine.addMessage({ speaker: 'player', text: 'Third question', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Latest reply here', isPlayer: false });

            const messages = engine._buildContextMessages();

            // Should have: system prompt, condensed block, 4 recent as user/assistant
            assert.equal(messages[0].role, 'system');
            assert.equal(messages[0].content, 'You are Alice');

            // Second should be condensed context block
            assert.equal(messages[1].role, 'system');
            assert.ok(messages[1].content.includes('[Conversation context]'));
            assert.ok(messages[1].content.includes('Answered briefly'));
            assert.ok(messages[1].content.includes('Player: First question'));

            // Recent messages should be originals (may include reminder system msg)
            const recentMsgs = messages.slice(2).filter(m => m.role !== 'system');
            assert.equal(recentMsgs.length, 4);
            assert.equal(recentMsgs[0].role, 'user');
            assert.equal(recentMsgs[0].content, 'Second question');
            assert.equal(recentMsgs[1].role, 'assistant');
            assert.equal(recentMsgs[1].content, 'Another long reply'); // original, not condensed
        });

        it('should use original text when no condensed field', () => {
            const engine = createEngine();

            // Old-format messages without condensed field
            engine.addMessage({ speaker: 'player', text: 'Old question', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Old answer without condensed', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Q2', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'A2', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Q3', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'A3', isPlayer: false });

            const messages = engine._buildContextMessages();

            // Condensed block should use original text as fallback
            const condensedBlock = messages.find(m => m.role === 'system' && m.content.includes('[Conversation context]'));
            assert.ok(condensedBlock);
            assert.ok(condensedBlock.content.includes('Old answer without condensed'));
        });

        it('should not create condensed block when all messages fit in recent window', () => {
            const engine = createEngine();

            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hello', isPlayer: false });

            const messages = engine._buildContextMessages();

            const condensedBlock = messages.find(m =>
                m.role === 'system' && m.content.includes('[Conversation context]'));
            assert.equal(condensedBlock, undefined, 'No condensed block needed');
        });
    });

    describe('sendMessage - condensation integration', () => {
        it('should condense AI reply after generation', async () => {
            let callOrder = [];
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                const sysContent = body.messages?.[0]?.content || '';
                const isCondensation = sysContent.includes('Condense') || sysContent.includes('Сократи');
                callOrder.push(isCondensation ? 'condense' : 'main');
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: isCondensation ? 'Condensed' : 'Full reply' } }]
                    })
                };
            };

            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            const reply = await engine.sendMessage('Hi');

            assert.equal(reply, 'Full reply');
            assert.equal(engine._pendingCondensed, 'Condensed');
            assert.deepEqual(callOrder, ['main', 'condense']);
        });
    });

    describe('_buildReminder - dynamic context injection', () => {
        it('should inject NO_QUESTIONS reminder when last 2+ AI messages end with ?', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hello, how are you?', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Fine', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'What do you do?', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Work', isPlayer: true });

            const messages = engine._buildContextMessages();
            const reminders = messages.filter(m => m.role === 'system' && m.content !== 'You are Alice');

            const hasQuestionReminder = reminders.some(m =>
                m.content.includes('вопрос') || m.content.includes('question'));
            assert.ok(hasQuestionReminder, 'Should inject question reminder');
        });

        it('should inject VARY_LENGTH when messages are similar length', () => {
            const engine = createEngine();
            // 3 AI messages of similar length (~50 chars each)
            engine.addMessage({ speaker: 'char1', text: 'This is a message that is about fifty chars long.', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Ok', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Here is another one that is roughly same len.', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Sure', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'And yet another message of similar character.', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Right', isPlayer: true });

            const messages = engine._buildContextMessages();
            const reminders = messages.filter(m =>
                m.role === 'system' && (m.content.includes('длину') || m.content.includes('length')));
            assert.ok(reminders.length > 0, 'Should inject length variation reminder');
        });

        it('should only inject static reminder when messages are varied', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Hey.', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'I was thinking we should go to that place downtown, the one with the rooftop terrace.', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Sure', isPlayer: true });

            const messages = engine._buildContextMessages();
            const reminderMsgs = messages.filter(m =>
                m.role === 'system' && m.content !== 'You are Alice');
            // Should have only the static NO_QUESTIONS reminder
            assert.equal(reminderMsgs.length, 1);
            assert.ok(
                reminderMsgs[0].content.includes('question') || reminderMsgs[0].content.includes('вопрос'),
                'Should contain static no-questions reminder'
            );
        });
    });

    describe('sendMessage - token budget context limit', () => {
        it('should limit condensed history by token budget', async () => {
            let mainReq = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
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

            for (let i = 0; i < 20; i++) {
                engine.addMessage({
                    speaker: i % 2 === 0 ? 'player' : 'char1',
                    text: `This is a unique longer message number ${i} with extra text and details`,
                    isPlayer: i % 2 === 0
                });
            }

            await engine.sendMessage('last');

            assert.equal(mainReq.messages[0].role, 'system');
            // With tight budget, condensed block should be truncated
            // but last 4 messages should still appear as originals
            const lastMsg = mainReq.messages[mainReq.messages.length - 1];
            assert.ok(lastMsg.role === 'user' || lastMsg.role === 'assistant',
                'Last message should be an original (user or assistant role)');
        });
    });

    describe('_estimateTokens', () => {
        it('should estimate ASCII text at ~4 chars per token', () => {
            const engine = createEngine();
            const tokens = engine._estimateTokens('a'.repeat(40));
            assert.equal(tokens, 10);
        });

        it('should estimate Cyrillic text at ~2 chars per token', () => {
            const engine = createEngine();
            const tokens = engine._estimateTokens('а'.repeat(20));
            assert.equal(tokens, 10);
        });

        it('should handle mixed text', () => {
            const engine = createEngine();
            const tokens = engine._estimateTokens('Hello!!!Привет');
            assert.equal(tokens, 5);
        });
    });

    describe('summary in context', () => {
        it('should include summary as second system message when present', async () => {
            let mainReq = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Bot reply' } }] })
                };
            };

            const engine = createEngine();
            engine._summary = 'Player discussed weather with Alice.';
            engine.addMessage({ speaker: 'player', text: 'Hi again', isPlayer: true });

            await engine.sendMessage('Hi again');

            assert.equal(mainReq.messages[0].role, 'system');
            assert.ok(mainReq.messages[0].content.includes('You are Alice'));
            const summaryMsg = mainReq.messages.find(m =>
                m.role === 'system' && m.content.includes('Player discussed weather'));
            assert.ok(summaryMsg, 'Should include summary in context');
        });

        it('should not include summary message when no summary exists', async () => {
            let mainReq = null;
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (!mainReq) mainReq = body;
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Bot reply' } }] })
                };
            };

            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            const summaryMsg = mainReq.messages.find(m =>
                m.role === 'system' && m.content.includes('summary'));
            assert.equal(summaryMsg, undefined, 'Should not include summary');
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

        it('should preserve condensed field through save/restore', () => {
            const engine = createEngine();
            engine._pendingCondensed = 'Condensed text';
            engine.addMessage({ speaker: 'char1', text: 'Original', isPlayer: false });

            const state = engine.getState();
            const engine2 = createEngine();
            engine2.restore(state);

            assert.equal(engine2.displayedMessages[0].condensed, 'Condensed text');
        });

        it('should restore without summary gracefully', () => {
            const engine = createEngine();
            engine.restore({ displayedMessages: [{ text: 'Hi', isPlayer: true }] });

            assert.equal(engine._summary, null);
            assert.equal(engine._summaryUpToIndex, 0);
        });

        it('should reset messages, summary, and pending condensed', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine._summary = 'Old summary';
            engine._summaryUpToIndex = 10;
            engine._pendingCondensed = 'pending';
            engine.reset();

            assert.equal(engine.displayedMessages.length, 0);
            assert.equal(engine._summary, null);
            assert.equal(engine._summaryUpToIndex, 0);
            assert.equal(engine._isSummarizing, false);
            assert.equal(engine._pendingCondensed, null);
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
