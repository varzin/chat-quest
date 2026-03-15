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

    describe('_detectPattern', () => {
        it('should detect pattern when messages have similar structure', () => {
            const engine = createEngine();
            // All messages: similar length, 2 sentences, end with *action*
            engine.addMessage({ speaker: 'char1', text: 'Sounds interesting, I like that idea. *smiles warmly*', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Tell me more', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Yeah that reminds me of something cool. *leans forward*', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Really?', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Of course, it was quite an experience. *nods slowly*', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Go on', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Well it changed my perspective on things. *looks away*', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'How so?', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hard to explain but it felt really right. *pauses briefly*', isPlayer: false });

            const result = engine._detectPattern();
            assert.equal(result.detected, true);
            assert.ok(result.signals.length >= 3, 'Should have at least 3 signals');
            assert.ok(result.signals.includes('all_end_with_action'));
        });

        it('should not detect pattern when messages vary', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Hey!', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'I was thinking we could go to that new place downtown. The one with the rooftop terrace. What do you think about trying it out this weekend?', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Sure', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Cool. *grabs her jacket and heads for the door*', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Wait', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hmm?', isPlayer: false });

            assert.equal(engine._detectPattern().detected, false);
        });

        it('should return not detected when fewer than 3 AI messages', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Hello there.', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'How are you?', isPlayer: false });

            assert.equal(engine._detectPattern().detected, false);
        });
    });

    describe('_rephrasePatternMessages', () => {
        it('should call API and replace assistant messages', async () => {
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                // Only respond to rephrase calls (system prompt contains "Rephrase")
                if (body.messages[0].content.includes('Rephrase')) {
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{ message: { content: '1. Rephrased first\n2. Rephrased second' } }]
                        })
                    };
                }
                return {
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: 'Bot reply' } }] })
                };
            };

            const engine = createEngine();
            const messages = [
                { role: 'system', content: 'You are Alice' },
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Original first' },
                { role: 'user', content: 'Ok' },
                { role: 'assistant', content: 'Original second' }
            ];

            const result = await engine._rephrasePatternMessages(messages);

            assert.equal(result[2].content, 'Rephrased first');
            assert.equal(result[4].content, 'Rephrased second');
            // Non-assistant messages unchanged
            assert.equal(result[0].content, 'You are Alice');
            assert.equal(result[1].content, 'Hi');
            assert.equal(result[3].content, 'Ok');
        });

        it('should return originals when API fails', async () => {
            global.fetch = async () => ({ ok: false, status: 500 });

            const engine = createEngine();
            const messages = [
                { role: 'system', content: 'prompt' },
                { role: 'assistant', content: 'Original' }
            ];

            const result = await engine._rephrasePatternMessages(messages);
            assert.equal(result[1].content, 'Original');
        });
    });

    describe('anti-repetition directive', () => {
        it('should inject directive when pattern is detected', async () => {
            // Mock fetch: rephrase calls return numbered rephrased, main calls return reply
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (body.messages[0].content.includes('Rephrase')) {
                    const aiCount = body.messages[1].content.split('\n').length;
                    const lines = Array.from({ length: aiCount }, (_, i) => `${i + 1}. Rephrased ${i + 1}`).join('\n');
                    return { ok: true, json: async () => ({ choices: [{ message: { content: lines } }] }) };
                }
                lastRequestBody = body;
                return { ok: true, json: async () => ({ choices: [{ message: { content: 'Reply' } }] }) };
            };

            const engine = createEngine();
            // Add messages that trigger pattern (similar length, end with *action*, same sentence count)
            for (let i = 0; i < 5; i++) {
                engine.addMessage({ speaker: 'char1', text: `О, это так интересно и замечательно, давай продолжим. *улыбается тепло*`, isPlayer: false });
                engine.addMessage({ speaker: 'player', text: `Давай`, isPlayer: true });
            }

            await engine.sendMessage('Давай');

            // Should have an anti-repetition system message
            const systemMessages = lastRequestBody.messages.filter(m => m.role === 'system');
            const directive = systemMessages.find(m => m.content.includes('ВАЖНО') || m.content.includes('IMPORTANT'));
            assert.ok(directive, 'Should inject anti-repetition directive');
        });

        it('should build Russian directive for Russian messages', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Привет, как дела? *улыбается*', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'Отлично, рада слышать! *кивает*', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'Здорово, давай продолжим! *смотрит*', isPlayer: false });

            const directive = engine._buildAntiRepetitionDirective(['all_end_with_action', 'same_length', 'same_sentence_count']);
            assert.ok(directive.includes('ВАЖНО'), 'Should be in Russian');
            assert.ok(directive.includes('звёздочках'), 'Should mention asterisks pattern');
        });

        it('should build English directive for English messages', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Hey, thats interesting. *smiles*', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'Cool, lets continue then. *nods*', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'Sure, I agree with that. *leans*', isPlayer: false });

            const directive = engine._buildAntiRepetitionDirective(['all_end_with_action', 'same_opening']);
            assert.ok(directive.includes('IMPORTANT'), 'Should be in English');
        });
    });

    describe('shadow rephrased copies', () => {
        it('should store rephrased texts in _rephrasedMap', async () => {
            global.fetch = async (_url, options) => {
                const body = JSON.parse(options.body);
                if (body.messages[0].content.includes('Rephrase')) {
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{ message: { content: '1. Shadow first\n2. Shadow second' } }]
                        })
                    };
                }
                return { ok: true, json: async () => ({ choices: [{ message: { content: 'Reply' } }] }) };
            };

            const engine = createEngine();
            const messages = [
                { role: 'system', content: 'You are Alice' },
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Original first' },
                { role: 'user', content: 'Ok' },
                { role: 'assistant', content: 'Original second' }
            ];

            // Add corresponding displayed messages
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Original first', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Ok', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Original second', isPlayer: false });

            await engine._rephrasePatternMessages(messages);

            assert.equal(engine._rephrasedMap.get(1), 'Shadow first');
            assert.equal(engine._rephrasedMap.get(3), 'Shadow second');
        });

        it('should use shadow copies in context building', async () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Original text', isPlayer: false });
            engine.addMessage({ speaker: 'player', text: 'Ok', isPlayer: true });

            // Set shadow copy for index 1
            engine._rephrasedMap.set(1, 'Rephrased shadow text');

            const ctx = engine._buildContextMessages();
            const assistantMsg = ctx.find(m => m.role === 'assistant');
            assert.equal(assistantMsg.content, 'Rephrased shadow text');
        });

        it('should persist shadow copies through save/restore', () => {
            const engine = createEngine();
            engine._rephrasedMap.set(1, 'Shadow text');
            engine._rephrasedMap.set(3, 'Another shadow');

            const state = engine.getState();
            const engine2 = createEngine();
            engine2.restore(state);

            assert.equal(engine2._rephrasedMap.get(1), 'Shadow text');
            assert.equal(engine2._rephrasedMap.get(3), 'Another shadow');
        });

        it('should clear shadow copies on reset', () => {
            const engine = createEngine();
            engine._rephrasedMap.set(1, 'Shadow');
            engine.reset();

            assert.equal(engine._rephrasedMap.size, 0);
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
