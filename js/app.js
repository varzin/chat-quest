'use strict';

/**
 * Chat Quest - Main Application Module
 */

import { initI18n, setLanguage, getLanguage, t, updatePageTranslations } from './i18n.js';
import * as storage from './storage.js';
import { parseScenario, generateId } from './parser.js';
import { InkEngine } from './engine.js';
import { AiEngine } from './ai-engine.js';
import UIController from './ui.js';

const MODE = { SCENARIO: 'scenario', AI_CHAT: 'ai-chat' };


class ChatQuestApp {
    constructor() {
        this.ui = new UIController();
        this.engine = null;
        this.aiEngine = null;
        this.currentMode = null;
        this.currentScenarioId = null;
        this.currentAiChatId = null;
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

        // Инициализируем иконки Lucide
        lucide.createIcons();

        // Настраиваем UI callbacks
        this._setupCallbacks();

        // Загружаем демо-сценарий если нет сценариев
        await this._ensureDemoScenario();

        // Обновляем список в sidebar
        this._refreshSidebarList();

        // Загружаем последний элемент
        const currentItem = storage.getCurrentItem();
        if (currentItem?.type === MODE.AI_CHAT) {
            this._loadAiChat(currentItem.id);
        } else if (currentItem?.type === MODE.SCENARIO || currentItem?.id) {
            this._loadScenario(currentItem.id || currentItem);
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
        this.ui.setDirector(settings.useDirector !== false);

        // Загружаем API ключи и персонажей
        this.ui.setApiKeys(storage.getApiKeys());
        this.ui.renderCharacters(storage.getCharacters());
        this.ui.populateAiChatSetup(storage.getApiKeys(), storage.getCharacters());
    }

    _setupCallbacks() {
        this._setupScenarioCallbacks();
        this._setupEditorCallbacks();
        this._setupSettingsCallbacks();
        this._setupAiChatCallbacks();
    }

    _setupScenarioCallbacks() {
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
                this._refreshSidebarList();

                if (this.currentMode === MODE.SCENARIO && this.currentScenarioId === id) {
                    this._loadFirstAvailable();
                }
            }
        });

        this.ui.on('onAddScenario', () => {
            this._editingScenarioId = null;
            this.ui.populateAiChatSetup(storage.getApiKeys(), storage.getCharacters());
            this.ui.openEditor('', true);
            this.ui.closeSidebar();
        });

        this.ui.on('onLoadFile', (file) => this._loadFile(file));

        this.ui.on('onRestart', async () => {
            if (this.currentMode === MODE.AI_CHAT && this.aiEngine) {
                const confirmed = await this.ui.confirm(
                    t('confirm'),
                    t('confirmRestartChat')
                );
                if (confirmed) {
                    this.aiEngine.reset();
                    this.ui.clearMessages();
                    this._saveAiChatProgress();
                    this.ui.focusInput();
                }
            } else if (this.engine && this.engine.allowRestart()) {
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
    }

    _setupEditorCallbacks() {
        this.ui.on('onEditorSave', (source) => this._saveScenario(source));
    }

    _setupSettingsCallbacks() {
        this.ui.on('onThemeChange', (theme) => {
            this.ui.setTheme(theme);
            storage.saveSettings({ theme });
        });

        this.ui.on('onTypingDelayChange', (minDelay, maxDelay) => {
            storage.saveSettings({
                typingMinDelay: minDelay,
                typingMaxDelay: maxDelay
            });
            this._updateEngineSettings();
        });

        this.ui.on('onLanguageChange', (lang) => {
            setLanguage(lang);
            storage.saveSettings({ language: lang });
            this._refreshSidebarList();
        });

        this.ui.on('onClearData', async () => {
            const confirmed = await this.ui.confirm(
                t('confirm'),
                t('confirmClearData')
            );
            if (confirmed) {
                storage.clearAllData();
                this.ui.closeSettings();
                location.reload();
            }
        });

        this.ui.on('onDirectorChange', (useDirector) => {
            if (this.aiEngine) {
                this.aiEngine.useDirector = useDirector;
            }
            if (this.currentAiChatId) {
                const chatData = storage.getAiChat(this.currentAiChatId);
                if (chatData) {
                    chatData.useDirector = useDirector;
                    storage.saveAiChat(this.currentAiChatId, chatData);
                }
            }
            storage.saveSettings({ useDirector });
        });

        this.ui.on('onApiKeySave', (provider, key) => {
            storage.saveApiKey(provider, key);
        });

        this.ui.on('onCharacterSave', (character) => {
            storage.saveCharacter(character);
            this.ui.renderCharacters(storage.getCharacters());

            // Update running AI engine if editing current chat's character
            if (this.aiEngine && this.currentAiChatId) {
                const chatData = storage.getAiChat(this.currentAiChatId);
                if (chatData && chatData.characterId === character.id) {
                    this.aiEngine.systemPrompt = character.prompt || '';
                    this.aiEngine.characterName = character.name;
                    this.ui.setChatHeader(chatData.title || character.name, chatData.model);
                }
            }
        });

        this.ui.on('onCharacterDelete', async (id, name) => {
            const confirmed = await this.ui.confirm(
                t('confirm'),
                t('confirmDeleteCharacter', { name })
            );
            if (confirmed) {
                storage.deleteCharacter(id);
                this.ui.renderCharacters(storage.getCharacters());
            }
        });
    }

    _setupAiChatCallbacks() {
        this.ui.on('onStartAiChat', (characterId, provider, model, title, useDirector) => {
            this._startNewAiChat(characterId, provider, model, title, useDirector);
        });

        this.ui.on('onAiChatSelect', (id) => this._loadAiChat(id));

        this.ui.on('onAiChatDelete', async (id, name) => {
            const confirmed = await this.ui.confirm(
                t('confirm'),
                t('confirmDeleteChat', { name })
            );
            if (confirmed) {
                storage.deleteAiChat(id);
                this._refreshSidebarList();

                if (this.currentMode === MODE.AI_CHAT && this.currentAiChatId === id) {
                    this._loadFirstAvailable();
                }
            }
        });

        this.ui.on('onSendMessage', (text) => this._handleSendMessage(text));

        this.ui.on('onChangeModel', (provider, model, useDirector) => {
            this._changeAiChatModel(provider, model, useDirector);
        });

        this.ui.on('onEditCharacter', () => {
            if (!this.aiEngine || !this.currentAiChatId) return;
            const chatData = storage.getAiChat(this.currentAiChatId);
            if (!chatData) return;
            const characters = storage.getCharacters();
            const character = characters.find(c => c.id === chatData.characterId);
            if (!character) return;
            this.ui.openCharacterEditor(character);
        });
    }

    // ========================================
    // Загрузка первого доступного
    // ========================================

    _loadFirstAvailable() {
        const scenarios = storage.getScenarioList();
        const aiChats = storage.getAiChatList();

        if (scenarios.length > 0) {
            this._loadScenario(scenarios[0].id);
        } else if (aiChats.length > 0) {
            this._loadAiChat(aiChats[0].id);
        } else {
            this._resetCurrentMode();
            this.ui.hideInputBar();
            this.ui.hideChoices();
            this.ui.hideChatSettings();
            this.ui.setRestartVisible(false);
            this.ui.showEmptyState();
            this.ui.setChatHeader('Chat Quest');
        }
    }

    // ========================================
    // Sidebar
    // ========================================

    _refreshSidebarList() {
        const scenarios = storage.getScenarioList();
        const aiChats = storage.getAiChatList();
        const currentItem = this.currentMode === MODE.AI_CHAT
            ? { type: MODE.AI_CHAT, id: this.currentAiChatId }
            : this.currentMode === MODE.SCENARIO
                ? { type: MODE.SCENARIO, id: this.currentScenarioId }
                : null;
        this.ui.renderSidebarList(scenarios, aiChats, currentItem);
    }

    // ========================================
    // Shared helpers
    // ========================================

    _resetCurrentMode() {
        this.currentMode = null;
        this.currentScenarioId = null;
        this.currentAiChatId = null;
        this.engine = null;
        this.aiEngine = null;
    }

    _updateEngineSettings() {
        const settings = storage.getSettings();
        if (this.engine) {
            this.engine.globalSettings = settings;
        }
        if (this.aiEngine) {
            this.aiEngine.globalSettings = settings;
        }
    }

    _restoreDisplayedMessages(messages, engine) {
        this.ui.clearMessages();
        messages.forEach(msg => {
            const character = engine.getCharacter(msg.speaker);
            this.ui.addMessage(msg, character);
        });
    }

    // ========================================
    // Scenario Mode
    // ========================================

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
            this.aiEngine = null;
            this.currentMode = MODE.SCENARIO;
            this.currentScenarioId = id;
            this.currentAiChatId = null;

            storage.setCurrentItem({ type: MODE.SCENARIO, id });

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
            this.ui.hideChatSettings();
            this.ui.hideEmptyState();
            this.ui.hideInputBar();
            this._refreshSidebarList();

        } catch (e) {
            console.error('Failed to load scenario:', e);
            this.ui.showEditorError(e.message);
        }
    }

    _startScenario() {
        this.ui.clearMessages();
        this.isPlaying = true;
        this._processContent();
    }

    _restartScenario() {
        if (this.engine) {
            this.engine.reset();
            storage.deleteProgress(this.currentScenarioId);
            this._startScenario();
        }
    }

    _restoreMessages() {
        this._restoreDisplayedMessages(this.engine.getMessages(), this.engine);
        this.isPlaying = true;
        this._processContent();
    }

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

    async _showTextSequentially(textItems) {
        for (const item of textItems) {
            const character = this.engine.getCharacter(item.speaker);
            const isPlayer = this.engine.isPlayer(item.speaker);

            if (!isPlayer) {
                this.ui.showTyping(character);
                const delay = this.engine.calculateTypingDelay(item.text);
                await this._delay(delay);
                this.ui.hideTyping();
            }

            const message = {
                speaker: item.speaker,
                text: item.text,
                isPlayer
            };

            this.ui.addMessage(message, character);
            this.engine.addMessage(message);

            if (!isPlayer) {
                await this._delay(200);
            }
        }
    }

    async _handleChoice(index) {
        if (!this.engine) return;

        const content = this.engine.getCurrentContent();
        if (content.choices && content.choices[index]) {
            const choice = content.choices[index];

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

        this.ui.hideChoices();
        this.engine.makeChoice(index);
        await this._delay(300);
        this._processContent();
    }

    _saveProgress() {
        if (this.engine && this.currentScenarioId) {
            storage.saveProgress(this.currentScenarioId, this.engine.getState());
        }
    }

    // ========================================
    // AI Chat Mode
    // ========================================

    /**
     * Создаёт и загружает новый AI чат
     */
    _startNewAiChat(characterId, provider, model, title, useDirector = true) {
        const characters = storage.getCharacters();
        const character = characters.find(c => c.id === characterId);
        if (!character) return;

        const apiKeys = storage.getApiKeys();
        const apiKey = provider === 'openai' ? apiKeys.openai : apiKeys.grok;
        if (!apiKey) return;

        const id = generateId();
        const settings = storage.getSettings();

        this.aiEngine = new AiEngine({
            characterId,
            characterName: character.name,
            systemPrompt: character.prompt || '',
            provider,
            model,
            apiKey,
            globalSettings: settings
        });
        this.aiEngine.useDirector = useDirector;

        this.engine = null;
        this.currentMode = MODE.AI_CHAT;
        this.currentAiChatId = id;
        this.currentScenarioId = null;

        const chatTitle = title || character.name;

        storage.saveAiChat(id, {
            title: chatTitle,
            characterId,
            characterName: character.name,
            provider,
            model,
            useDirector,
            messages: []
        });
        storage.setCurrentItem({ type: MODE.AI_CHAT, id });

        // Обновляем UI
        this.ui.clearMessages();
        this.ui.setChatHeader(chatTitle, model);
        this.ui.showChatSettings();
        this.ui.hideEmptyState();
        this.ui.hideChoices();
        this.ui.showInputBar();
        this.ui.focusInput();
        this._refreshSidebarList();
    }

    /**
     * Загружает существующий AI чат
     */
    _loadAiChat(id) {
        const chatData = storage.getAiChat(id);
        if (!chatData) {
            console.error('AI chat not found:', id);
            return;
        }

        const characters = storage.getCharacters();
        const character = characters.find(c => c.id === chatData.characterId);
        const apiKeys = storage.getApiKeys();
        const apiKey = chatData.provider === 'openai' ? apiKeys.openai : apiKeys.grok;

        if (!apiKey) {
            console.error('API key not found for provider:', chatData.provider);
            return;
        }

        const settings = storage.getSettings();

        this.aiEngine = new AiEngine({
            characterId: chatData.characterId,
            characterName: chatData.characterName,
            systemPrompt: character?.prompt || '',
            provider: chatData.provider,
            model: chatData.model,
            apiKey,
            globalSettings: settings
        });
        if (chatData.useDirector !== undefined) {
            this.aiEngine.useDirector = chatData.useDirector;
        }

        this.engine = null;
        this.currentMode = MODE.AI_CHAT;
        this.currentAiChatId = id;
        this.currentScenarioId = null;

        storage.setCurrentItem({ type: MODE.AI_CHAT, id });

        // Restore messages
        if (chatData.messages?.length > 0) {
            this.aiEngine.restore({ displayedMessages: chatData.messages });
            this._restoreDisplayedMessages(chatData.messages, this.aiEngine);
        } else {
            this.ui.clearMessages();
        }

        // Обновляем UI
        this.ui.setChatHeader(chatData.title || chatData.characterName, chatData.model);
        this.ui.showChatSettings();
        this.ui.hideEmptyState();
        this.ui.hideChoices();
        this.ui.showInputBar();
        this._refreshSidebarList();
    }

    /**
     * Обрабатывает отправку сообщения в AI чат
     */
    async _handleSendMessage(text) {
        if (!this.aiEngine) return;

        // Показываем сообщение пользователя
        const playerMessage = { speaker: 'player', text, isPlayer: true };
        this.ui.addMessage(playerMessage, null);
        this.aiEngine.addMessage(playerMessage);

        // Показываем typing и блокируем ввод
        const npcChar = { name: this.aiEngine.characterName, avatar: null };
        this.ui.showTyping(npcChar);
        this.ui.setInputEnabled(false);

        try {
            const responseText = await this.aiEngine.sendMessage(text);
            this.ui.hideTyping();

            const npcMessage = {
                speaker: this.aiEngine.characterId,
                text: responseText,
                isPlayer: false
            };

            this.ui.addMessage(npcMessage, npcChar);
            this.aiEngine.addMessage(npcMessage);
        } catch (error) {
            this.ui.hideTyping();

            const errorMsg = {
                speaker: 'system',
                text: `Error: ${error.message}`,
                isPlayer: false
            };
            this.ui.addMessage(errorMsg, { name: 'System', avatar: null });
        }

        // Сохраняем в любом случае — чтобы сообщение игрока не пропало при ошибке
        this._saveAiChatProgress();

        this.ui.setInputEnabled(true);
        this.ui.focusInput();
    }

    _saveAiChatProgress() {
        if (!this.aiEngine || !this.currentAiChatId) return;

        const state = this.aiEngine.getState();
        const chatData = storage.getAiChat(this.currentAiChatId);
        if (chatData) {
            chatData.messages = state.displayedMessages;
            storage.saveAiChat(this.currentAiChatId, chatData);
        }
    }

    _changeAiChatModel(provider, model, useDirector) {
        if (!this.aiEngine || !this.currentAiChatId) return;

        const apiKeys = storage.getApiKeys();
        const apiKey = provider === 'openai' ? apiKeys.openai : apiKeys.grok;
        if (!apiKey) return;

        this.aiEngine.provider = provider;
        this.aiEngine.model = model;
        this.aiEngine.apiKey = apiKey;
        if (useDirector !== undefined) {
            this.aiEngine.useDirector = useDirector;
        }

        const chatData = storage.getAiChat(this.currentAiChatId);
        if (chatData) {
            chatData.provider = provider;
            chatData.model = model;
            chatData.useDirector = this.aiEngine.useDirector;
            storage.saveAiChat(this.currentAiChatId, chatData);
        }

        this.ui.setChatHeader(
            chatData?.title || chatData?.characterName || '',
            model
        );
    }

    // ========================================
    // File / Editor
    // ========================================

    async _loadFile(file) {
        try {
            const source = await file.text();
            const { config } = parseScenario(source);

            const id = config.dialog.id || generateId();
            storage.saveScenario(id, config.dialog.title || t('untitled'), source, false);

            this._refreshSidebarList();
            this._loadScenario(id);
            this.ui.closeSidebar();

        } catch (e) {
            console.error('Failed to load file:', e);
            alert(t('parseError') + ': ' + e.message);
        }
    }

    _saveScenario(source) {
        try {
            const { config } = parseScenario(source);

            const id = this._editingScenarioId || config.dialog.id || generateId();
            const scenarios = storage.getScenarioList();
            const existing = scenarios.find(s => s.id === id);
            const isDemo = existing?.isDemo || false;

            storage.saveScenario(id, config.dialog.title || t('untitled'), source, isDemo);

            const isNew = !this._editingScenarioId;
            if (isNew || (this.currentMode === MODE.SCENARIO && id === this.currentScenarioId)) {
                storage.deleteProgress(id);
                this._loadScenario(id);
            }

            this._refreshSidebarList();
            this.ui.closeEditor();
            this._editingScenarioId = null;

        } catch (e) {
            console.error('Failed to save scenario:', e);
            this.ui.showEditorError(t('parseError') + ': ' + e.message);
        }
    }

    // ========================================
    // Helpers
    // ========================================

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.chatQuestApp = new ChatQuestApp();
});
