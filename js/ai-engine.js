'use strict';

/**
 * AI Chat Engine - отправка сообщений к OpenAI/Grok API
 * Поддерживает токен-бюджет и суммаризацию для оптимизации контекста
 */

const ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    grok: 'https://api.x.ai/v1/chat/completions'
};

const DEFAULT_HISTORY_TOKEN_BUDGET = 4000;
const SUMMARY_TRIGGER_MESSAGES = 30;
const SUMMARY_INTERVAL_MESSAGES = 20;
const RECENT_MESSAGES_KEEP = 10;

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
     * Собирает историю сообщений в пределах токен-бюджета (с конца)
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

        // Собираем итоговый массив
        const result = [
            { role: 'system', content: this.systemPrompt }
        ];

        if (this._summary) {
            result.push({ role: 'system', content: `Previous conversation summary: ${this._summary}` });
        }

        result.push(...selected);
        return result;
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
                messages: apiMessages
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
