'use strict';

/**
 * AI Chat Engine - отправка сообщений к OpenAI/Grok API
 */

const ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    grok: 'https://api.x.ai/v1/chat/completions'
};

const MAX_CONTEXT_MESSAGES = 50;

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
    }

    /**
     * Отправляет сообщение и получает ответ
     * @param {string} userText
     * @returns {Promise<string>}
     */
    async sendMessage(userText) {
        const endpoint = ENDPOINTS[this.provider];
        if (!endpoint) throw new Error(`Unknown provider: ${this.provider}`);

        // Собираем контекст из истории
        const apiMessages = [
            { role: 'system', content: this.systemPrompt }
        ];

        // Берём последние N сообщений для контекста
        // (userText уже добавлен в displayedMessages через addMessage)
        const history = this.displayedMessages.slice(-MAX_CONTEXT_MESSAGES);
        for (const msg of history) {
            apiMessages.push({
                role: msg.isPlayer ? 'user' : 'assistant',
                content: msg.text
            });
        }

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
        return data.choices?.[0]?.message?.content || '';
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
            displayedMessages: [...this.displayedMessages]
        };
    }

    restore(state) {
        if (state.displayedMessages) {
            this.displayedMessages = [...state.displayedMessages];
        }
    }

    reset() {
        this.displayedMessages = [];
    }
}

export default AiEngine;
