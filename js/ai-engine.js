'use strict';

/**
 * AI Chat Engine - отправка сообщений к OpenAI/Grok API
 * Поддерживает токен-бюджет, суммаризацию и анти-репетиционную архитектуру
 *
 * Anti-repetition architecture:
 * 1. API penalties (frequency_penalty, presence_penalty) — baseline token-level defense
 * 2. Semantic deduplication — structurally similar AI messages removed from context
 * 3. Variation state injection — explicit JSON block tracking patterns to avoid
 * 4. Primacy bias — anti-repetition preamble at the top of system prompt
 */

const ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    grok: 'https://api.x.ai/v1/chat/completions'
};

const DEFAULT_HISTORY_TOKEN_BUDGET = 4000;
const SUMMARY_TRIGGER_MESSAGES = 30;
const SUMMARY_INTERVAL_MESSAGES = 20;
const RECENT_MESSAGES_KEEP = 4;
const PATTERN_CHECK_COUNT = 6;
const SIMILARITY_THRESHOLD = 0.4;
const FREQUENCY_PENALTY = 0.45;
const PRESENCE_PENALTY = 0.35;

export class AiEngine {
    /**
     * @param {Object} params
     * @param {string} params.characterId
     * @param {string} params.characterName
     * @param {string} params.systemPrompt
     * @param {string} params.provider - 'openai' или 'grok'
     * @param {string} params.model
     * @param {string} params.apiKey
     * @param {Object} params.globalSettings
     */
    constructor({ characterId, characterName, systemPrompt, provider, model, apiKey, globalSettings }) {
        this.characterId = characterId;
        this.characterName = characterName;
        this.systemPrompt = systemPrompt;
        this.provider = provider;
        this.model = model;
        this.apiKey = apiKey;
        this.globalSettings = globalSettings;
        this.displayedMessages = [];
        this._summary = null;
        this._summaryUpToIndex = 0;
        this._isSummarizing = false;
    }

    /**
     * Оценка количества токенов в тексте
     * ASCII ~4 символа/токен, не-ASCII (кириллица и т.д.) ~2 символа/токен
     * @param {string} text
     * @returns {number}
     */
    _estimateTokens(text) {
        let ascii = 0;
        let nonAscii = 0;
        for (let i = 0; i < text.length; i++) {
            if (text.charCodeAt(i) < 128) {
                ascii++;
            } else {
                nonAscii++;
            }
        }
        return Math.ceil(ascii / 4 + nonAscii / 2);
    }

    /**
     * Извлекает последние N сообщений персонажа (не игрока)
     * @param {number} count
     * @returns {string[]}
     */
    _getRecentAiTexts(count) {
        const texts = [];
        for (let i = this.displayedMessages.length - 1; i >= 0 && texts.length < count; i--) {
            if (!this.displayedMessages[i].isPlayer) {
                texts.unshift(this.displayedMessages[i].text);
            }
        }
        return texts;
    }

    /**
     * Извлекает структурные характеристики текста сообщения
     * @param {string} text
     * @returns {{ len: number, sentenceCount: number, endsWithAction: boolean, endsWithQuestion: boolean, firstWord: string, hasAction: boolean, ngrams: Set<string> }}
     */
    _analyzeMessage(text) {
        const sentences = text.split(/[.!?…]+/).filter(s => s.trim().length > 0);
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        // Bigrams for similarity comparison
        const ngrams = new Set();
        for (let i = 0; i < words.length - 1; i++) {
            ngrams.add(words[i] + ' ' + words[i + 1]);
        }
        return {
            len: text.length,
            sentenceCount: sentences.length,
            endsWithAction: /\*[^*]+\*\s*$/.test(text),
            endsWithQuestion: /\?\s*$/.test(text),
            firstWord: text.trim().split(/\s+/)[0]?.toLowerCase() || '',
            hasAction: /\*[^*]+\*/.test(text),
            ngrams
        };
    }

    /**
     * Вычисляет структурное сходство двух сообщений (0-1)
     * Комбинирует n-gram overlap и структурные признаки
     * @param {string} a
     * @param {string} b
     * @returns {number}
     */
    _similarity(a, b) {
        const sa = this._analyzeMessage(a);
        const sb = this._analyzeMessage(b);

        let score = 0;
        let checks = 0;

        // 1. N-gram overlap (Jaccard)
        if (sa.ngrams.size > 0 && sb.ngrams.size > 0) {
            let intersection = 0;
            for (const ng of sa.ngrams) {
                if (sb.ngrams.has(ng)) intersection++;
            }
            const union = sa.ngrams.size + sb.ngrams.size - intersection;
            score += (intersection / union) * 2; // Weight x2 — most important signal
            checks += 2;
        }

        // 2. Similar length (±25%)
        const maxLen = Math.max(sa.len, sb.len);
        if (maxLen > 0 && Math.abs(sa.len - sb.len) / maxLen < 0.25) {
            score += 1;
        }
        checks += 1;

        // 3. Same sentence count
        if (sa.sentenceCount === sb.sentenceCount) {
            score += 1;
        }
        checks += 1;

        // 4. Same ending pattern
        if (sa.endsWithAction === sb.endsWithAction && sa.endsWithAction) {
            score += 1;
        }
        if (sa.endsWithQuestion === sb.endsWithQuestion && sa.endsWithQuestion) {
            score += 1;
        }
        checks += 2;

        // 5. Same opening word
        if (sa.firstWord === sb.firstWord && sa.firstWord.length > 0) {
            score += 1;
        }
        checks += 1;

        return checks > 0 ? score / checks : 0;
    }

    /**
     * Удаляет структурно похожие AI-сообщения из контекста.
     * Оставляет самое свежее, заменяет дубликаты однострочным summary.
     * @param {Array<{role: string, content: string}>} messages
     * @returns {Array<{role: string, content: string}>}
     */
    _deduplicateContext(messages) {
        // Collect assistant message indices (skip system messages)
        const assistantIndices = [];
        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'assistant') {
                assistantIndices.push(i);
            }
        }
        if (assistantIndices.length < 3) return messages;

        // Compare each pair, mark earlier duplicates for removal
        const toRemove = new Set();
        for (let i = 0; i < assistantIndices.length; i++) {
            if (toRemove.has(assistantIndices[i])) continue;
            for (let j = i + 1; j < assistantIndices.length; j++) {
                if (toRemove.has(assistantIndices[j])) continue;
                const sim = this._similarity(
                    messages[assistantIndices[i]].content,
                    messages[assistantIndices[j]].content
                );
                if (sim >= SIMILARITY_THRESHOLD) {
                    // Remove the earlier one, keep the later
                    toRemove.add(assistantIndices[i]);
                    break;
                }
            }
        }

        if (toRemove.size === 0) return messages;

        // Build result: skip removed messages and their preceding user messages
        // (to keep user-assistant pairing clean)
        const result = [];
        for (let i = 0; i < messages.length; i++) {
            if (toRemove.has(i)) {
                // Also remove the user message right before this assistant message
                if (result.length > 0 && result[result.length - 1].role === 'user') {
                    result.pop();
                }
                continue;
            }
            result.push(messages[i]);
        }
        return result;
    }

    /**
     * Строит JSON-блок вариативного состояния для инжекции в контекст.
     * Описывает структурные паттерны последних AI-ответов и явно указывает чего избегать.
     * @returns {string|null} — state block or null if not enough data
     */
    _buildVariationState() {
        const texts = this._getRecentAiTexts(PATTERN_CHECK_COUNT);
        if (texts.length < 2) return null;

        const analyses = texts.map(t => this._analyzeMessage(t));
        const lang = this._detectLanguage(texts.join(' '));

        // Gather pattern observations
        const patterns = [];

        // Opening words
        const openers = analyses.map(a => a.firstWord);
        const openerCounts = {};
        openers.forEach(w => { openerCounts[w] = (openerCounts[w] || 0) + 1; });
        const repeatedOpener = Object.entries(openerCounts).find(([, c]) => c >= 2);
        if (repeatedOpener) {
            patterns.push(lang === 'ru'
                ? `начало с "${repeatedOpener[0]}" (${repeatedOpener[1]}/${texts.length})`
                : `opening with "${repeatedOpener[0]}" (${repeatedOpener[1]}/${texts.length})`);
        }

        // Action endings
        const actionEndings = analyses.filter(a => a.endsWithAction).length;
        if (actionEndings >= 2) {
            patterns.push(lang === 'ru'
                ? `концовка *действием* (${actionEndings}/${texts.length})`
                : `ending with *action* (${actionEndings}/${texts.length})`);
        }

        // Question endings
        const questionEndings = analyses.filter(a => a.endsWithQuestion).length;
        if (questionEndings >= 2) {
            patterns.push(lang === 'ru'
                ? `концовка вопросом (${questionEndings}/${texts.length})`
                : `ending with question (${questionEndings}/${texts.length})`);
        }

        // Asterisk actions in general
        const hasActions = analyses.filter(a => a.hasAction).length;
        if (hasActions >= 3) {
            patterns.push(lang === 'ru'
                ? `*действия в звёздочках* (${hasActions}/${texts.length})`
                : `*asterisk actions* (${hasActions}/${texts.length})`);
        }

        // Similar lengths
        const lengths = analyses.map(a => a.len);
        const avgLen = lengths.reduce((s, l) => s + l, 0) / lengths.length;
        const allSimilarLen = lengths.every(l => Math.abs(l - avgLen) / avgLen < 0.2);
        if (allSimilarLen && texts.length >= 3) {
            patterns.push(lang === 'ru'
                ? `одинаковая длина (~${Math.round(avgLen)} символов)`
                : `same length (~${Math.round(avgLen)} chars)`);
        }

        // Same sentence count
        const sentenceCounts = new Set(analyses.map(a => a.sentenceCount));
        if (sentenceCounts.size === 1 && texts.length >= 3) {
            const count = analyses[0].sentenceCount;
            patterns.push(lang === 'ru'
                ? `всегда ${count} предложений`
                : `always ${count} sentences`);
        }

        if (patterns.length === 0) return null;

        if (lang === 'ru') {
            return `[Анти-повторение] Обнаружены паттерны в твоих последних ответах: ${patterns.join('; ')}. В следующем ответе ИЗБЕГАЙ этих паттернов. Варьируй длину, структуру, начало и концовку.`;
        }
        return `[Anti-repetition] Patterns detected in your recent responses: ${patterns.join('; ')}. In your next response AVOID these patterns. Vary length, structure, opening and ending.`;
    }

    /**
     * Строит anti-repetition preamble для начала system prompt (primacy bias)
     * @returns {string}
     */
    _buildPreamble() {
        const lang = this._detectLanguage(this.systemPrompt);
        if (lang === 'ru') {
            return 'ВАЖНО: Каждый твой ответ должен отличаться по структуре от предыдущих. Варьируй длину, начало фразы, порядок элементов (действие/речь/мысль). Никогда не повторяй одну и ту же формулу ответа дважды подряд.\n\n';
        }
        return 'IMPORTANT: Each response must differ structurally from your previous ones. Vary length, opening, element order (action/speech/thought). Never repeat the same response formula twice in a row.\n\n';
    }

    /**
     * Собирает историю сообщений в пределах токен-бюджета (с конца)
     * Применяет дедупликацию и инжектирует variation state
     * @returns {Array<{role: string, content: string}>}
     */
    _buildContextMessages() {
        const budget = this.globalSettings?.historyTokenBudget || DEFAULT_HISTORY_TOKEN_BUDGET;
        let remaining = budget;

        // Если есть summary, вычтем его токены из бюджета
        if (this._summary) {
            remaining -= this._estimateTokens(this._summary);
        }

        // Заполняем с конца, пока есть бюджет
        const selected = [];
        for (let i = this.displayedMessages.length - 1; i >= 0 && remaining > 0; i--) {
            const msg = this.displayedMessages[i];
            const tokens = this._estimateTokens(msg.text);
            if (tokens > remaining && selected.length > 0) break;
            remaining -= tokens;
            selected.unshift({
                role: msg.isPlayer ? 'user' : 'assistant',
                content: msg.text
            });
        }

        // System prompt with primacy bias preamble
        const result = [
            { role: 'system', content: this._buildPreamble() + this.systemPrompt }
        ];

        if (this._summary) {
            result.push({ role: 'system', content: `Previous conversation summary: ${this._summary}` });
        }

        result.push(...selected);

        // Semantic deduplication — remove structurally similar AI messages
        const deduplicated = this._deduplicateContext(result);

        // Variation state injection — right before the last user message
        const variationState = this._buildVariationState();
        if (variationState) {
            const lastUserIdx = deduplicated.findLastIndex(m => m.role === 'user');
            if (lastUserIdx > 0) {
                deduplicated.splice(lastUserIdx, 0, { role: 'system', content: variationState });
            }
        }

        return deduplicated;
    }

    /**
     * Отправляет сообщение и получает ответ
     * @param {string} userText
     * @returns {Promise<string>}
     */
    async sendMessage(userText) {
        const endpoint = ENDPOINTS[this.provider];
        if (!endpoint) throw new Error(`Unknown provider: ${this.provider}`);

        const apiMessages = this._buildContextMessages();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: apiMessages,
                frequency_penalty: FREQUENCY_PENALTY,
                presence_penalty: PRESENCE_PENALTY
            })
        });

        if (!response.ok) {
            const status = response.status;
            if (status === 401) throw new Error('Invalid API key');
            if (status === 429) throw new Error('Rate limit exceeded');
            if (status === 402) throw new Error('Insufficient credits');
            const body = await response.text().catch(() => '');
            throw new Error(`API error ${status}: ${body.slice(0, 200)}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        // Попытка суммаризации (не блокирует ответ при ошибке)
        await this._maybeSummarize();

        return reply;
    }

    /**
     * Проверяет нужна ли суммаризация и запускает её
     */
    async _maybeSummarize() {
        if (this._isSummarizing) return;
        if (this.displayedMessages.length <= SUMMARY_TRIGGER_MESSAGES) return;
        if (this.displayedMessages.length - this._summaryUpToIndex < SUMMARY_INTERVAL_MESSAGES) return;

        try {
            await this._generateSummary();
        } catch (e) {
            console.warn('Summarization failed, continuing without:', e.message);
        }
    }

    /**
     * Определяет язык по наличию кириллицы
     * @param {string} text
     * @returns {'ru'|'en'}
     */
    _detectLanguage(text) {
        let cyrillic = 0;
        const sample = text.slice(0, 500);
        for (let i = 0; i < sample.length; i++) {
            const code = sample.charCodeAt(i);
            if (code >= 0x0400 && code <= 0x04FF) cyrillic++;
        }
        return cyrillic > sample.length * 0.15 ? 'ru' : 'en';
    }

    /**
     * Генерирует summary старых сообщений через API
     */
    async _generateSummary() {
        this._isSummarizing = true;
        try {
            const endpoint = ENDPOINTS[this.provider];
            const endIdx = this.displayedMessages.length - RECENT_MESSAGES_KEEP;
            if (endIdx <= this._summaryUpToIndex) return;

            const messagesToSummarize = this.displayedMessages.slice(this._summaryUpToIndex, endIdx);

            // Формируем текст диалога для суммаризации
            const dialogText = messagesToSummarize.map(msg => {
                const speaker = msg.isPlayer ? 'Player' : (msg.speaker || 'NPC');
                return `${speaker}: ${msg.text}`;
            }).join('\n');

            // Определяем язык
            const lang = this._detectLanguage(dialogText);
            const langInstruction = lang === 'ru'
                ? 'Ответь на русском языке.'
                : 'Respond in English.';

            let userContent = '';
            if (this._summary) {
                userContent = `Previous summary:\n${this._summary}\n\nNew messages:\n${dialogText}`;
            } else {
                userContent = dialogText;
            }

            const summaryMessages = [
                {
                    role: 'system',
                    content: `Summarize this conversation in 2-3 sentences. Keep character names, key facts, decisions, and emotional tone. ${langInstruction}`
                },
                { role: 'user', content: userContent }
            ];

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: summaryMessages
                })
            });

            if (!response.ok) {
                throw new Error(`Summary API error ${response.status}`);
            }

            const data = await response.json();
            const summaryText = data.choices?.[0]?.message?.content;
            if (summaryText) {
                this._summary = summaryText;
                this._summaryUpToIndex = endIdx;
            }
        } finally {
            this._isSummarizing = false;
        }
    }

    // ========================================
    // Интерфейс совместимый с InkEngine
    // ========================================

    getTitle() {
        return this.characterName;
    }

    getMessages() {
        return this.displayedMessages;
    }

    addMessage(message) {
        this.displayedMessages.push(message);
    }

    getCharacter(speakerId) {
        if (speakerId === 'player') return null;
        return { name: this.characterName, avatar: null };
    }

    isPlayer(speakerId) {
        return speakerId === 'player';
    }

    allowRestart() {
        return true;
    }

    calculateTypingDelay(text) {
        const minDelay = this.globalSettings?.typingMinDelay || 400;
        const maxDelay = this.globalSettings?.typingMaxDelay || 1600;
        const calculated = text.length * 100;
        return Math.min(Math.max(calculated, minDelay), maxDelay);
    }

    getState() {
        return {
            characterId: this.characterId,
            characterName: this.characterName,
            systemPrompt: this.systemPrompt,
            provider: this.provider,
            model: this.model,
            displayedMessages: [...this.displayedMessages],
            _summary: this._summary,
            _summaryUpToIndex: this._summaryUpToIndex
        };
    }

    restore(state) {
        if (state.displayedMessages) {
            this.displayedMessages = [...state.displayedMessages];
        }
        this._summary = state._summary || null;
        this._summaryUpToIndex = state._summaryUpToIndex || 0;
    }

    reset() {
        this.displayedMessages = [];
        this._summary = null;
        this._summaryUpToIndex = 0;
        this._isSummarizing = false;
    }
}

export default AiEngine;
