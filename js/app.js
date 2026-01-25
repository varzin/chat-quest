'use strict';

/**
 * Chat Quest - Main Application Module
 */

import { initI18n, setLanguage, getLanguage, t, updatePageTranslations } from './i18n.js';
import * as storage from './storage.js';
import { parseScenario, generateId } from './parser.js';
import InkEngine from './engine.js';
import UIController from './ui.js';


class ChatQuestApp {
    constructor() {
        this.ui = new UIController();
        this.engine = null;
        this.currentScenarioId = null;
        this.isPlaying = false;

        this._init();
    }

    /**
     * Инициализация приложения
     */
    async _init() {
        // Загружаем настройки
        const settings = storage.getSettings();
        initI18n(settings.language);

        // Настраиваем UI callbacks
        this._setupCallbacks();

        // Загружаем демо-сценарий если нет сценариев
        await this._ensureDemoScenario();

        // Обновляем список сценариев
        this._refreshScenarioList();

        // Загружаем последний сценарий или показываем пустое состояние
        const currentId = storage.getCurrentScenarioId();
        if (currentId) {
            this._loadScenario(currentId);
        } else {
            const scenarios = storage.getScenarioList();
            if (scenarios.length > 0) {
                this._loadScenario(scenarios[0].id);
            } else {
                this.ui.showEmptyState();
            }
        }

        // Устанавливаем язык, тему и typing delays в UI настроек
        this.ui.setLanguage(getLanguage());
        this.ui.setTheme(settings.theme || 'default');
        this.ui.setTypingDelays(settings.typingMinDelay || 400, settings.typingMaxDelay || 1600);
    }

    /**
     * Настраивает callbacks для UI
     */
    _setupCallbacks() {
        this.ui.on('onScenarioSelect', (id) => this._loadScenario(id));

        this.ui.on('onScenarioEdit', (id) => {
            const source = storage.getScenarioSource(id);
            if (source) {
                this._editingScenarioId = id;
                this.ui.openEditor(source, false);
            }
        });

        this.ui.on('onScenarioDelete', async (id, title) => {
            const confirmed = await this.ui.confirm(
                t('confirm'),
                t('confirmDelete', { title })
            );
            if (confirmed) {
                storage.deleteScenario(id);
                this._refreshScenarioList();

                // Если удалили текущий, загружаем другой
                if (this.currentScenarioId === id) {
                    const scenarios = storage.getScenarioList();
                    if (scenarios.length > 0) {
                        this._loadScenario(scenarios[0].id);
                    } else {
                        this.currentScenarioId = null;
                        this.engine = null;
                        this.ui.showEmptyState();
                        this.ui.setChatHeader('Chat Quest');
                    }
                }
            }
        });

        this.ui.on('onAddScenario', () => {
            this._editingScenarioId = null;
            this.ui.openEditor('', true);
            this.ui.closeSidebar();
        });

        this.ui.on('onLoadFile', (file) => this._loadFile(file));

        this.ui.on('onRestart', async () => {
            if (this.engine && this.engine.allowRestart()) {
                const confirmed = await this.ui.confirm(
                    t('confirm'),
                    t('confirmRestart')
                );
                if (confirmed) {
                    this._restartScenario();
                }
            }
        });

        this.ui.on('onChoice', (index) => this._handleChoice(index));

        this.ui.on('onEditorSave', (source) => this._saveScenario(source));

        this.ui.on('onThemeChange', (theme) => {
            this.ui.setTheme(theme);
            storage.saveSettings({ theme });
        });

        this.ui.on('onTypingDelayChange', (minDelay, maxDelay) => {
            storage.saveSettings({
                typingMinDelay: minDelay,
                typingMaxDelay: maxDelay
            });

            // Обновить engine если он существует
            if (this.engine) {
                const settings = storage.getSettings();
                this.engine.globalSettings = settings;
            }
        });

        this.ui.on('onLanguageChange', (lang) => {
            setLanguage(lang);
            storage.saveSettings({ language: lang });
            this._refreshScenarioList();
        });

        this.ui.on('onClearData', async () => {
            const confirmed = await this.ui.confirm(
                t('confirm'),
                t('confirmClearData')
            );
            if (confirmed) {
                storage.clearAllData();
                this.ui.closeSettings();
                // Перезагружаем страницу для чистого старта
                location.reload();
            }
        });
    }

    /**
     * Убеждается что демо-сценарий существует
     */
    async _ensureDemoScenario() {
        const scenarios = storage.getScenarioList();
        const hasDemo = scenarios.some(s => s.isDemo);

        if (!hasDemo) {
            try {
                const response = await fetch('./scenarios/demo.ink');
                if (!response.ok) {
                    throw new Error(`Failed to fetch demo scenario: ${response.status}`);
                }
                const source = await response.text();
                const { config } = parseScenario(source);
                storage.saveScenario(
                    config.dialog.id,
                    config.dialog.title,
                    source,
                    true
                );
            } catch (e) {
                console.error('Failed to load demo scenario:', e);
            }
        }
    }

    /**
     * Обновляет список сценариев в sidebar
     */
    _refreshScenarioList() {
        const scenarios = storage.getScenarioList();
        this.ui.renderScenarioList(scenarios, this.currentScenarioId);
    }

    /**
     * Загружает сценарий по ID
     * @param {string} id
     */
    _loadScenario(id) {
        const source = storage.getScenarioSource(id);
        if (!source) {
            console.error('Scenario not found:', id);
            return;
        }

        try {
            const { config, knots, variables } = parseScenario(source);

            const settings = storage.getSettings();
            this.engine = new InkEngine(config, knots, variables, settings);
            this.currentScenarioId = id;

            // Сохраняем как текущий
            storage.setCurrentScenarioId(id);

            // Проверяем сохранённый прогресс
            const progress = storage.getProgress(id);
            if (progress && progress.displayedMessages?.length > 0) {
                this.engine.restore(progress);
                this._restoreMessages();
            } else {
                this._startScenario();
            }

            // Обновляем UI
            this.ui.setChatHeader(this.engine.getTitle());
            this.ui.setRestartVisible(this.engine.allowRestart());
            this.ui.hideEmptyState();
            this._refreshScenarioList();

        } catch (e) {
            console.error('Failed to load scenario:', e);
            this.ui.showEditorError(e.message);
        }
    }

    /**
     * Начинает сценарий с начала
     */
    _startScenario() {
        this.ui.clearMessages();
        this.isPlaying = true;
        this._processContent();
    }

    /**
     * Перезапускает сценарий
     */
    _restartScenario() {
        if (this.engine) {
            this.engine.reset();
            storage.deleteProgress(this.currentScenarioId);
            this._startScenario();
        }
    }

    /**
     * Восстанавливает сообщения из сохранения
     */
    _restoreMessages() {
        this.ui.clearMessages();

        const messages = this.engine.getMessages();
        messages.forEach(msg => {
            const character = this.engine.getCharacter(msg.speaker);
            this.ui.addMessage(msg, character);
        });

        this.isPlaying = true;
        this._processContent();
    }

    /**
     * Обрабатывает текущий контент сценария
     */
    async _processContent() {
        if (!this.engine || !this.isPlaying) return;

        const content = this.engine.getCurrentContent();

        switch (content.type) {
            case 'text':
                await this._showTextSequentially(content.data);
                this._processContent();
                break;

            case 'textWithChoices':
                if (content.text.length > 0) {
                    await this._showTextSequentially(content.text);
                }
                this.ui.showChoices(content.choices);
                this._saveProgress();
                break;

            case 'choices':
                this.ui.showChoices(content.choices);
                this._saveProgress();
                break;

            case 'end':
                this.isPlaying = false;
                this.ui.hideChoices();
                this._saveProgress();
                break;
        }
    }

    /**
     * Показывает текстовые сообщения последовательно с typing indicator
     * @param {Array} textItems
     */
    async _showTextSequentially(textItems) {
        for (const item of textItems) {
            const character = this.engine.getCharacter(item.speaker);
            const isPlayer = this.engine.isPlayer(item.speaker);

            // Для NPC показываем typing indicator
            if (!isPlayer) {
                this.ui.showTyping(character);
                const delay = this.engine.calculateTypingDelay(item.text);
                await this._delay(delay);
                this.ui.hideTyping();
            }

            // Показываем сообщение
            const message = {
                speaker: item.speaker,
                text: item.text,
                isPlayer
            };

            this.ui.addMessage(message, character);
            this.engine.addMessage(message);

            // Небольшая пауза между сообщениями
            if (!isPlayer) {
                await this._delay(200);
            }
        }
    }

    /**
     * Обрабатывает выбор пользователя
     * @param {number} index
     */
    async _handleChoice(index) {
        if (!this.engine) return;

        // Получаем текст выбора и показываем как сообщение игрока
        const content = this.engine.getCurrentContent();
        if (content.choices && content.choices[index]) {
            const choice = content.choices[index];

            // Показываем сообщение только если suppressEcho явно false (текст БЕЗ квадратных скобок)
            if (choice.suppressEcho === false) {
                const playerChar = this.engine.getCharacter(
                    this.engine.config.dialog.participants[1]
                );

                const message = {
                    speaker: this.engine.config.dialog.participants[1],
                    text: choice.text,
                    isPlayer: true
                };

                this.ui.addMessage(message, playerChar);
                this.engine.addMessage(message);
            }
        }

        // Скрываем выборы
        this.ui.hideChoices();

        // Делаем выбор в движке
        this.engine.makeChoice(index);

        // Небольшая пауза перед следующим контентом
        await this._delay(300);

        // Продолжаем обработку
        this._processContent();
    }

    /**
     * Сохраняет прогресс
     */
    _saveProgress() {
        if (this.engine && this.currentScenarioId) {
            storage.saveProgress(this.currentScenarioId, this.engine.getState());
        }
    }

    /**
     * Загружает файл сценария
     * @param {File} file
     */
    async _loadFile(file) {
        try {
            const source = await file.text();
            const { config } = parseScenario(source);

            const id = config.dialog.id || generateId();
            storage.saveScenario(id, config.dialog.title || t('untitled'), source, false);

            this._refreshScenarioList();
            this._loadScenario(id);
            this.ui.closeSidebar();

        } catch (e) {
            console.error('Failed to load file:', e);
            alert(t('parseError') + ': ' + e.message);
        }
    }

    /**
     * Сохраняет сценарий из редактора
     * @param {string} source
     */
    _saveScenario(source) {
        try {
            const { config } = parseScenario(source);

            const id = this._editingScenarioId || config.dialog.id || generateId();
            const scenarios = storage.getScenarioList();
            const existing = scenarios.find(s => s.id === id);
            const isDemo = existing?.isDemo || false;

            storage.saveScenario(id, config.dialog.title || t('untitled'), source, isDemo);

            // Если это новый сценарий или редактировали текущий - загружаем его
            const isNew = !this._editingScenarioId;
            if (isNew || id === this.currentScenarioId) {
                storage.deleteProgress(id);
                this._loadScenario(id);
            }

            this._refreshScenarioList();
            this.ui.closeEditor();
            this._editingScenarioId = null;

        } catch (e) {
            console.error('Failed to save scenario:', e);
            this.ui.showEditorError(t('parseError') + ': ' + e.message);
        }
    }

    /**
     * Утилита для задержки
     * @param {number} ms
     * @returns {Promise}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.chatQuestApp = new ChatQuestApp();
});
