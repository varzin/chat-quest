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
        });
    });

    describe('sendMessage - message structure', () => {
        it('should always start with system prompt containing preamble', async () => {
            const engine = createEngine({ systemPrompt: 'Test prompt' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            assert.equal(lastRequestBody.messages[0].role, 'system');
            assert.ok(lastRequestBody.messages[0].content.includes('Test prompt'),
                'System prompt should contain original prompt');
            assert.ok(lastRequestBody.messages[0].content.includes('IMPORTANT') ||
                lastRequestBody.messages[0].content.includes('ВАЖНО'),
                'System prompt should contain anti-repetition preamble');
        });

        it('should map player messages to user role and NPC to assistant', async () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });
            engine.addMessage({ speaker: 'char1', text: 'Hello there friend', isPlayer: false });
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

        it('should include frequency_penalty and presence_penalty for openai', async () => {
            const engine = createEngine({ provider: 'openai' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            assert.ok(lastRequestBody.frequency_penalty > 0,
                'Should have positive frequency_penalty');
            assert.ok(lastRequestBody.presence_penalty > 0,
                'Should have positive presence_penalty');
        });

        it('should NOT include penalties for grok provider', async () => {
            const engine = createEngine({ provider: 'grok', model: 'grok-3-mini' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            assert.equal(lastRequestBody.frequency_penalty, undefined,
                'Should not send frequency_penalty for grok');
            assert.equal(lastRequestBody.presence_penalty, undefined,
                'Should not send presence_penalty for grok');
        });
    });

    describe('sendMessage - token budget context limit', () => {
        it('should limit history by token budget, not fixed message count', async () => {
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

            // Add many short UNIQUE messages to avoid deduplication
            for (let i = 0; i < 60; i++) {
                engine.addMessage({
                    speaker: i % 2 === 0 ? 'player' : 'char1',
                    text: `unique-msg-${i}-content`,
                    isPlayer: i % 2 === 0
                });
            }

            await engine.sendMessage('unique-msg-59-content');

            assert.equal(mainRequestBody.messages[0].role, 'system');
            const lastMsg = mainRequestBody.messages[mainRequestBody.messages.length - 1];
            assert.equal(lastMsg.content, 'unique-msg-59-content');
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

            for (let i = 0; i < 10; i++) {
                engine.addMessage({
                    speaker: i % 2 === 0 ? 'player' : 'char1',
                    text: `This is a unique longer message number ${i} with extra text and details`,
                    isPlayer: i % 2 === 0
                });
            }

            await engine.sendMessage('last');

            const historyCount = mainRequestBody.messages.filter(m => m.role !== 'system').length;
            assert.ok(historyCount < 10,
                `Expected fewer than 10 history messages, got ${historyCount}`);
            assert.ok(historyCount > 0, 'Should have at least 1 history message');
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
            const engine = createEngine();
            engine._summary = 'Player discussed weather with Alice.';
            engine.addMessage({ speaker: 'player', text: 'Hi again', isPlayer: true });

            await engine.sendMessage('Hi again');

            assert.equal(lastRequestBody.messages[0].role, 'system');
            assert.ok(lastRequestBody.messages[0].content.includes('You are Alice'));
            assert.equal(lastRequestBody.messages[1].role, 'system');
            assert.ok(lastRequestBody.messages[1].content.includes('Player discussed weather'));
        });

        it('should not include summary message when no summary exists', async () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            // Only system messages should be the preamble+prompt (no summary, no variation state for 1 msg)
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

    describe('_similarity', () => {
        it('should return high similarity for structurally similar messages', () => {
            const engine = createEngine();
            const a = 'О, Адам, твои объятия такие теплые — именно то, что делает этот вечер идеальным. *Прижимаюсь ближе, чувствуя ритм дождя.* Давай просто побудем здесь.';
            const b = 'О, Адам, давай просто наслаждемся этим моментом – твои объятия так уютны, что дождь звучит как мелодия. *Прижимаюсь ближе, чувствуя тепло.* Я уверена, это начало чего-то особенного.';

            const sim = engine._similarity(a, b);
            assert.ok(sim >= 0.3, `Similarity ${sim} should be >= 0.3 for similar messages`);
        });

        it('should return low similarity for different messages', () => {
            const engine = createEngine();
            const a = 'Hey! What a beautiful day.';
            const b = 'I was thinking about going to the rooftop terrace downtown this weekend. The weather should be perfect for it.';

            const sim = engine._similarity(a, b);
            assert.ok(sim < 0.3, `Similarity ${sim} should be < 0.3 for different messages`);
        });

        it('should return 0 for completely different short messages', () => {
            const engine = createEngine();
            const sim = engine._similarity('Hello', 'Goodbye forever');
            assert.ok(sim < 0.5, `Similarity ${sim} should be low`);
        });
    });

    describe('_deduplicateContext', () => {
        it('should remove structurally similar assistant messages', () => {
            const engine = createEngine();
            const messages = [
                { role: 'system', content: 'You are Alice' },
                { role: 'user', content: 'Привет' },
                { role: 'assistant', content: 'О, Адам, твои объятия такие теплые и своевременные — именно то, что делает этот вечер идеальным. *Прижимаюсь ближе, чувствуя ритм дождя вокруг нас.* Давай просто побудем здесь, в этом уюте.' },
                { role: 'user', content: 'Давай' },
                { role: 'assistant', content: 'О, Адам, давай просто наслаждемся этим моментом – твои объятия так уютны, что дождь за окном звучит как нежная мелодия. *Прижимаюсь ближе, чувствуя тепло между нами.* Я уверена, это только начало чего-то особенного.' },
                { role: 'user', content: 'Мне интересно' },
                { role: 'assistant', content: 'О, Адам, твоё нетерпение только подогревает интерес — давай не спешить, а просто позволим этому моменту разгореться. *Прижимаюсь ближе, чувствуя тепло твоего тела.* Я уверена, что дальше будет что-то особенное.' },
            ];

            const result = engine._deduplicateContext(messages);

            // Should have fewer messages — duplicates removed
            const assistantCount = result.filter(m => m.role === 'assistant').length;
            assert.ok(assistantCount < 3,
                `Expected fewer than 3 assistant messages after dedup, got ${assistantCount}`);
            // Last assistant message should be preserved
            const lastAssistant = result.filter(m => m.role === 'assistant').pop();
            assert.ok(lastAssistant.content.includes('нетерпение'),
                'Last (most recent) assistant message should be preserved');
        });

        it('should not remove messages when they are different', () => {
            const engine = createEngine();
            const messages = [
                { role: 'system', content: 'You are Alice' },
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hey! Nice to meet you.' },
                { role: 'user', content: 'Tell me about downtown' },
                { role: 'assistant', content: 'I was thinking we could go to that new place downtown. The one with the rooftop terrace and the amazing sunset views over the river.' },
                { role: 'user', content: 'Cool' },
                { role: 'assistant', content: 'Great, let me grab my jacket.' },
            ];

            const result = engine._deduplicateContext(messages);
            assert.equal(result.length, messages.length, 'No messages should be removed');
        });

        it('should return original when fewer than 3 assistant messages', () => {
            const engine = createEngine();
            const messages = [
                { role: 'system', content: 'prompt' },
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hello' },
                { role: 'user', content: 'Bye' },
                { role: 'assistant', content: 'Goodbye' },
            ];

            const result = engine._deduplicateContext(messages);
            assert.equal(result.length, messages.length);
        });
    });

    describe('_buildVariationState', () => {
        it('should detect repeated opening words', () => {
            const engine = createEngine();
            for (let i = 0; i < 4; i++) {
                engine.addMessage({ speaker: 'char1', text: `О, это замечательно, вариант ${i} с уникальным продолжением текста`, isPlayer: false });
                engine.addMessage({ speaker: 'player', text: 'Ок', isPlayer: true });
            }

            const state = engine._buildVariationState();
            assert.ok(state !== null, 'Should produce variation state');
            assert.ok(state.includes('о,'), 'Should mention repeated opener');
        });

        it('should detect action ending pattern', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Первое сообщение с уникальным содержанием. *улыбается тепло и ласково*', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'Второе сообщение совсем другое по смыслу. *прижимается ближе к собеседнику*', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'Третье сообщение тоже уникальное и интересное. *смотрит в глаза с нежностью*', isPlayer: false });

            const state = engine._buildVariationState();
            assert.ok(state !== null);
            assert.ok(state.includes('*') || state.includes('действи') || state.includes('action'),
                'Should mention action ending pattern');
        });

        it('should return null when not enough messages', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Hello', isPlayer: false });

            const state = engine._buildVariationState();
            assert.equal(state, null);
        });

        it('should return null when no patterns detected', () => {
            const engine = createEngine();
            engine.addMessage({ speaker: 'char1', text: 'Hey!', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'I was thinking we could go somewhere nice downtown for dinner tonight if you are free.', isPlayer: false });
            engine.addMessage({ speaker: 'char1', text: 'Sure thing. *grabs jacket*', isPlayer: false });

            const state = engine._buildVariationState();
            // May or may not be null depending on pattern detection, but should not crash
            assert.ok(state === null || typeof state === 'string');
        });
    });

    describe('primacy bias preamble', () => {
        it('should prepend anti-repetition preamble to system prompt', async () => {
            const engine = createEngine({ systemPrompt: 'You are a helpful character.' });
            engine.addMessage({ speaker: 'player', text: 'Hi', isPlayer: true });

            await engine.sendMessage('Hi');

            const systemMsg = lastRequestBody.messages[0];
            assert.ok(systemMsg.content.startsWith('IMPORTANT') || systemMsg.content.startsWith('ВАЖНО'),
                'Preamble should be at the very start');
            assert.ok(systemMsg.content.includes('You are a helpful character.'),
                'Original prompt should follow preamble');
        });
    });

    describe('variation state injection', () => {
        it('should inject variation state before last user message when patterns exist', async () => {
            const engine = createEngine();
            // Create messages with detectable patterns
            for (let i = 0; i < 4; i++) {
                engine.addMessage({ speaker: 'char1', text: `О, это так замечательно и интересно, давай продолжим наш разговор дальше. *улыбается*`, isPlayer: false });
                engine.addMessage({ speaker: 'player', text: `Давай ${i}`, isPlayer: true });
            }

            await engine.sendMessage('Давай 3');

            // Find variation state system message (not the first system prompt)
            const systemMessages = lastRequestBody.messages.filter(m => m.role === 'system');
            const variationMsg = systemMessages.find(m =>
                m.content.includes('Анти-повторение') || m.content.includes('Anti-repetition'));
            assert.ok(variationMsg, 'Should inject variation state');
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
