'use strict';

/**
 * AI Chat Engine - отправка сообщений к OpenAI/Grok API
 * Поддерживает токен-бюджет, per-message condensation и суммаризацию
 *
 * Context architecture:
 * 1. Per-message condensation — AI responses condensed to essential content after generation
 * 2. Condensed context — older messages sent as system-role summaries (no style contamination)
 * 3. Original recent window — last N messages sent as-is for tone continuity
 * 4. API penalties (frequency_penalty, presence_penalty) — complementary token-level defense
 * 5. Rolling summary — fallback for very old messages beyond token budget
 */

const ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    grok: 'https://api.x.ai/v1/chat/completions'
};

const DEFAULT_HISTORY_TOKEN_BUDGET = 4000;
const SUMMARY_TRIGGER_MESSAGES = 50;
const SUMMARY_INTERVAL_MESSAGES = 30;
const RECENT_MESSAGES_KEEP = 4;
const CONDENSE_MAX_TOKENS = 150;
const FREQUENCY_PENALTY = 0.45;
const PRESENCE_PENALTY = 0.35;
const REMINDER_CHECK_COUNT = 3;

const REMINDERS = {
    NO_QUESTIONS: {
        ru: 'Не заканчивай вопросом. Добавь от себя: факт, воспоминание, предложение или наблюдение.',
        en: 'Do not end with a question. Add something of your own: a fact, memory, suggestion, or observation.'
    },
    VARY_LENGTH: {
        ru: 'Измени длину — сделай заметно короче или длиннее предыдущих.',
        en: 'Change length — make it noticeably shorter or longer than previous ones.'
    }
};

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
        this._pendingCondensed = null;
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
     * Сжимает сообщение персонажа до сути (1-2 предложения, третье лицо)
     * @param {string} messageText
     * @returns {Promise<string>} — condensed text or original on failure
     */
    async _condenseMessage(messageText) {
        const endpoint = ENDPOINTS[this.provider];
        if (!endpoint) return messageText;

        const lang = this._detectLanguage(messageText);
        const prompt = lang === 'ru'
            ? 'Сократи это сообщение ролевой игры до сути в 1-2 предложениях, от третьего лица. Извлеки ТОЛЬКО: что произошло, что было сказано, какие решения/действия. Убери стиль, атмосферу, повторяющиеся описания. Сохрани имена и конкретные детали.'
            : 'Condense this roleplay message to its essential content in 1-2 sentences, third person. Extract ONLY: what happened, what was communicated, any decisions or actions taken. Strip all style, atmosphere, repetitive descriptions. Keep character names and concrete details.';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content: messageText }
                    ],
                    max_tokens: CONDENSE_MAX_TOKENS
                })
            });

            if (!response.ok) return messageText;

            const data = await response.json();
            return data.choices?.[0]?.message?.content || messageText;
        } catch (e) {
            console.warn('Condensation failed, using original:', e.message);
            return messageText;
        }
    }

    /**
     * Возвращает объект с penalties для API-запроса.
     * Grok и некоторые другие провайдеры не поддерживают эти параметры.
     * @returns {Object}
     */
    _getPenalties() {
        if (this.provider === 'grok') return {};
        return {
            frequency_penalty: FREQUENCY_PENALTY,
            presence_penalty: PRESENCE_PENALTY
        };
    }

    /**
     * Собирает историю сообщений для API.
     * Последние RECENT_MESSAGES_KEEP — оригиналы (user/assistant).
     * Более старые — сжатые версии в одном system-сообщении.
     * @returns {Array<{role: string, content: string}>}
     */
    _buildContextMessages() {
        const budget = this.globalSettings?.historyTokenBudget || DEFAULT_HISTORY_TOKEN_BUDGET;
        let remaining = budget;

        // 1. System prompt
        const result = [
            { role: 'system', content: this.systemPrompt }
        ];

        // 2. Summary для очень старых сообщений
        if (this._summary) {
            remaining -= this._estimateTokens(this._summary);
            result.push({ role: 'system', content: `Previous conversation summary: ${this._summary}` });
        }

        const total = this.displayedMessages.length;
        const recentStart = Math.max(0, total - RECENT_MESSAGES_KEEP);

        // 3. Сжатые сообщения (старше recent window) — одно system-сообщение
        const condensedParts = [];
        const condensedStart = this._summaryUpToIndex || 0;
        for (let i = condensedStart; i < recentStart && remaining > 0; i++) {
            const msg = this.displayedMessages[i];
            const text = msg.condensed || msg.text;
            const tokens = this._estimateTokens(text);
            if (tokens > remaining && condensedParts.length > 0) break;
            remaining -= tokens;

            const speaker = msg.isPlayer ? 'Player' : this.characterName;
            condensedParts.push(`${speaker}: ${text}`);
        }

        if (condensedParts.length > 0) {
            result.push({
                role: 'system',
                content: `[Conversation context]\n${condensedParts.join('\n')}`
            });
        }

        // 4. Последние сообщения — оригиналы как user/assistant
        for (let i = recentStart; i < total; i++) {
            const msg = this.displayedMessages[i];
            const tokens = this._estimateTokens(msg.text);
            if (tokens > remaining && i > recentStart) break;
            remaining -= tokens;
            result.push({
                role: msg.isPlayer ? 'user' : 'assistant',
                content: msg.text
            });
        }

        // 5. Динамические напоминания — между предпоследним и последним сообщением
        const reminderText = this._buildReminder(result);
        if (reminderText) {
            // Вставляем за 2 позиции до конца (между msg[-2] и msg[-1])
            const insertIdx = Math.max(1, result.length - 2);
            result.splice(insertIdx, 0, { role: 'system', content: reminderText });
        }

        return result;
    }

    /**
     * Собирает динамические напоминания на основе паттернов в последних сообщениях.
     * Инжектируется близко к концу контекста для максимального влияния (recency bias).
     * @param {Array<{role: string, content: string}>} contextMessages
     * @returns {string|null}
     */
    _buildReminder(contextMessages) {
        const recentAi = [];
        for (let i = contextMessages.length - 1; i >= 0 && recentAi.length < REMINDER_CHECK_COUNT; i--) {
            if (contextMessages[i].role === 'assistant') {
                recentAi.push(contextMessages[i].content);
            }
        }

        const lang = this._detectLanguage(
            recentAi.length > 0 ? recentAi.join(' ') : this.systemPrompt
        );
        const issues = [];

        // 1. Вопросы + инициатива — статическое напоминание (всегда)
        issues.push(REMINDERS.NO_QUESTIONS[lang]);

        if (recentAi.length < 2) {
            return issues.join(' ');
        }

        // 2. Одинаковая длина? (все ±20% от средней)
        const lengths = recentAi.map(t => t.length);
        const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        if (avg > 0 && lengths.every(l => Math.abs(l - avg) / avg < 0.2)) {
            issues.push(REMINDERS.VARY_LENGTH[lang]);
        }

        return issues.join(' ');
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
                ...this._getPenalties()
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

        // Сжимаем ответ для будущего контекста
        this._pendingCondensed = await this._condenseMessage(reply);

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
     * Генерирует summary старых сообщений через API
     */
    async _generateSummary() {
        this._isSummarizing = true;
        try {
            const endpoint = ENDPOINTS[this.provider];
            const endIdx = this.displayedMessages.length - RECENT_MESSAGES_KEEP;
            if (endIdx <= this._summaryUpToIndex) return;

            const messagesToSummarize = this.displayedMessages.slice(this._summaryUpToIndex, endIdx);

            // Используем condensed версии если доступны
            const dialogText = messagesToSummarize.map(msg => {
                const speaker = msg.isPlayer ? 'Player' : (msg.speaker || 'NPC');
                const text = msg.condensed || msg.text;
                return `${speaker}: ${text}`;
            }).join('\n');

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
        if (!message.isPlayer && this._pendingCondensed) {
            message.condensed = this._pendingCondensed;
            this._pendingCondensed = null;
        }
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
        this._pendingCondensed = null;
    }
}

export default AiEngine;
