'use strict';

/**
 * Движок выполнения Ink-сценария
 */

export class InkEngine {
    /**
     * @param {Object} config - Конфигурация из YAML
     * @param {Object} knots - Узлы сценария
     * @param {Object} variables - Переменные
     */
    constructor(config, knots, variables) {
        this.config = config;
        this.knots = knots;
        this.initialVariables = { ...variables };

        // Состояние
        this.variables = { ...variables };
        this.currentKnot = 'start';
        this.currentIndex = 0;
        this.isEnded = false;
        this.displayedMessages = [];
    }

    /**
     * Сбрасывает состояние сценария
     */
    reset() {
        this.variables = { ...this.initialVariables };
        this.currentKnot = 'start';
        this.currentIndex = 0;
        this.isEnded = false;
        this.displayedMessages = [];
    }

    /**
     * Восстанавливает состояние из сохранения
     * @param {Object} state
     */
    restore(state) {
        if (state) {
            this.currentKnot = state.currentKnot || 'start';
            this.currentIndex = state.currentIndex || 0;
            this.variables = state.variables || { ...this.initialVariables };
            this.isEnded = state.isEnded || false;
            this.displayedMessages = state.displayedMessages || [];
        }
    }

    /**
     * Сериализует текущее состояние для сохранения
     * @returns {Object}
     */
    getState() {
        return {
            currentKnot: this.currentKnot,
            currentIndex: this.currentIndex,
            variables: { ...this.variables },
            isEnded: this.isEnded,
            displayedMessages: [...this.displayedMessages]
        };
    }

    /**
     * Получает текущий контент (текст или выборы)
     * @returns {Object} - { type: 'text'|'choices'|'end', data: ... }
     */
    getCurrentContent() {
        if (this.isEnded) {
            return { type: 'end' };
        }

        const knot = this.knots[this.currentKnot];
        if (!knot) {
            this.isEnded = true;
            return { type: 'end' };
        }

        const content = knot.content;

        // Собираем текст до первого выбора или divert
        const textItems = [];
        const choices = [];

        for (let i = this.currentIndex; i < content.length; i++) {
            const item = content[i];

            if (item.type === 'text') {
                textItems.push(item);
            } else if (item.type === 'choice') {
                choices.push({ ...item, index: i });
            } else if (item.type === 'divert') {
                // Обрабатываем переход
                if (item.target === 'END') {
                    this.isEnded = true;
                    // Сначала возвращаем оставшийся текст
                    if (textItems.length > 0) {
                        this.currentIndex = i;
                        return { type: 'text', data: textItems };
                    }
                    return { type: 'end' };
                } else {
                    // Переходим к другому knot
                    this.currentKnot = item.target;
                    this.currentIndex = 0;
                    // Сначала возвращаем оставшийся текст
                    if (textItems.length > 0) {
                        return { type: 'text', data: textItems };
                    }
                    // Рекурсивно получаем контент нового knot
                    return this.getCurrentContent();
                }
            }
        }

        // Если есть выборы, возвращаем текст + выборы
        if (choices.length > 0) {
            // Обновляем индекс до первого choice
            this.currentIndex = choices[0].index;
            return {
                type: textItems.length > 0 ? 'textWithChoices' : 'choices',
                text: textItems,
                choices: choices.map(c => ({ text: c.text, target: c.target, suppressEcho: c.suppressEcho }))
            };
        }

        // Только текст (без выборов)
        if (textItems.length > 0) {
            this.currentIndex = content.length;
            return { type: 'text', data: textItems };
        }

        // Ничего нет - конец knot без перехода
        this.isEnded = true;
        return { type: 'end' };
    }

    /**
     * Продвигает сценарий после показа текста
     * @returns {Object} - Следующий контент
     */
    advance() {
        const knot = this.knots[this.currentKnot];
        if (!knot) {
            this.isEnded = true;
            return { type: 'end' };
        }

        // Ищем следующий элемент
        const content = knot.content;

        for (let i = this.currentIndex; i < content.length; i++) {
            const item = content[i];

            if (item.type === 'choice') {
                // Достигли выборов
                return this.getCurrentContent();
            } else if (item.type === 'divert') {
                if (item.target === 'END') {
                    this.isEnded = true;
                    return { type: 'end' };
                } else {
                    this.currentKnot = item.target;
                    this.currentIndex = 0;
                    return this.getCurrentContent();
                }
            }
        }

        return this.getCurrentContent();
    }

    /**
     * Обрабатывает выбор пользователя
     * @param {number} choiceIndex - Индекс выбора
     */
    makeChoice(choiceIndex) {
        const knot = this.knots[this.currentKnot];
        if (!knot) {
            this.isEnded = true;
            return;
        }

        // Находим выборы
        const content = knot.content;
        const choices = [];

        for (let i = this.currentIndex; i < content.length; i++) {
            const item = content[i];
            if (item.type === 'choice') {
                choices.push(item);
            }
        }

        const choice = choices[choiceIndex];
        if (!choice) {
            return;
        }

        // Обрабатываем переход
        if (choice.target) {
            if (choice.target === 'END') {
                this.isEnded = true;
            } else {
                this.currentKnot = choice.target;
                this.currentIndex = 0;
            }
        } else {
            // Если нет target, переходим в конец knot
            this.currentIndex = content.length;
        }
    }

    /**
     * Добавляет сообщение в историю
     * @param {Object} message
     */
    addMessage(message) {
        this.displayedMessages.push(message);
    }

    /**
     * Получает историю сообщений
     * @returns {Array}
     */
    getMessages() {
        return this.displayedMessages;
    }

    /**
     * Получает информацию о персонаже
     * @param {string} speakerId
     * @returns {Object}
     */
    getCharacter(speakerId) {
        return this.config.characters?.[speakerId] || null;
    }

    /**
     * Определяет, является ли персонаж игроком
     * @param {string} speakerId
     * @returns {boolean}
     */
    isPlayer(speakerId) {
        const participants = this.config.dialog?.participants || [];
        // Обычно player - второй участник
        return speakerId === participants[1] || speakerId === 'player';
    }

    /**
     * Получает настройки typing из конфига
     * @returns {Object}
     */
    getTypingSettings() {
        return this.config.ui?.typing || { minDelayMs: 300, maxDelayMs: 2000 };
    }

    /**
     * Вычисляет задержку для typing indicator на основе длины сообщения
     * @param {string} text
     * @returns {number}
     */
    calculateTypingDelay(text) {
        const settings = this.getTypingSettings();
        const minDelay = settings.minDelayMs || 300;
        const maxDelay = settings.maxDelayMs || 2000;

        // Примерно 50мс на символ, но в пределах min/max
        const charDelay = 50;
        const calculatedDelay = text.length * charDelay;

        return Math.min(Math.max(calculatedDelay, minDelay), maxDelay);
    }

    /**
     * Проверяет, разрешён ли перезапуск
     * @returns {boolean}
     */
    allowRestart() {
        return this.config.ui?.allowRestart !== false;
    }

    /**
     * Получает заголовок сценария
     * @returns {string}
     */
    getTitle() {
        return this.config.dialog?.title || 'Chat Quest';
    }

    /**
     * Получает ID сценария
     * @returns {string}
     */
    getId() {
        return this.config.dialog?.id || '';
    }
}

export default InkEngine;
