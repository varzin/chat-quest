'use strict';

import { t } from './i18n.js';
import { generateId } from './parser.js';

/**
 * UI Controller - управление интерфейсом
 */

class UIController {
    constructor() {
        // DOM элементы
        this.elements = {
            // Sidebar
            sidebar: document.getElementById('sidebar'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            sidebarClose: document.getElementById('sidebar-close'),
            scenarioList: document.getElementById('scenario-list'),
            btnAddScenario: document.getElementById('btn-add-scenario'),
            btnSettings: document.getElementById('btn-settings'),

            // Chat
            btnMenu: document.getElementById('btn-menu'),
            btnRestart: document.getElementById('btn-restart'),
            chatTitle: document.getElementById('chat-title'),
            chatSubtitle: document.getElementById('chat-subtitle'),
            messages: document.getElementById('messages'),
            choices: document.getElementById('choices'),
            choicesContent: document.getElementById('choices-content'),
            emptyState: document.getElementById('empty-state'),

            // Editor Modal
            editorModal: document.getElementById('editor-modal'),
            editorTitle: document.getElementById('editor-title'),
            editorTextarea: document.getElementById('editor-textarea'),
            editorError: document.getElementById('editor-error'),
            editorClose: document.getElementById('editor-close'),
            editorCancel: document.getElementById('editor-cancel'),
            editorSave: document.getElementById('editor-save'),
            editorTemplate: document.getElementById('editor-template'),
            editorPaste: document.getElementById('editor-paste'),
            editorLoadFile: document.getElementById('editor-load-file'),
            editorFileInput: document.getElementById('editor-file-input'),

            // Settings Modal
            settingsModal: document.getElementById('settings-modal'),
            settingsClose: document.getElementById('settings-close'),
            settingsTheme: document.getElementById('settings-theme'),
            settingsTypingMin: document.getElementById('settings-typing-min'),
            settingsTypingMax: document.getElementById('settings-typing-max'),
            settingsLanguage: document.getElementById('settings-language'),
            btnClearData: document.getElementById('btn-clear-data'),

            // API Keys
            apiKeyOpenai: document.getElementById('api-key-openai'),
            apiKeyGrok: document.getElementById('api-key-grok'),

            // Characters
            charactersList: document.getElementById('characters-list'),
            btnAddCharacter: document.getElementById('btn-add-character'),
            characterModal: document.getElementById('character-modal'),
            characterModalTitle: document.getElementById('character-modal-title'),
            characterName: document.getElementById('character-name'),
            characterPrompt: document.getElementById('character-prompt'),
            characterCancel: document.getElementById('character-cancel'),
            characterModalCancel: document.getElementById('character-modal-cancel'),
            characterSave: document.getElementById('character-save'),

            // Editor Tabs & AI Chat Setup
            editorTabs: document.getElementById('editor-tabs'),
            aiChatNoKeys: document.getElementById('ai-chat-no-keys'),
            aiChatNoChars: document.getElementById('ai-chat-no-chars'),
            aiChatSetup: document.getElementById('ai-chat-setup'),
            aiChatFooter: document.getElementById('ai-chat-footer'),
            aiChatTitle: document.getElementById('ai-chat-title'),
            aiChatCharacter: document.getElementById('ai-chat-character'),
            aiChatModel: document.getElementById('ai-chat-model'),
            aiChatStart: document.getElementById('ai-chat-start'),
            aiChatCancel: document.getElementById('ai-chat-cancel'),
            aiChatFixSettings: document.getElementById('ai-chat-fix-settings'),
            aiChatFixChars: document.getElementById('ai-chat-fix-chars'),

            // Chat Input
            chatInput: document.getElementById('chat-input'),
            chatInputField: document.getElementById('chat-input-field'),
            btnSend: document.getElementById('btn-send'),

            // Confirm Modal
            confirmModal: document.getElementById('confirm-modal'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmMessage: document.getElementById('confirm-message'),
            confirmCancel: document.getElementById('confirm-cancel'),
            confirmOk: document.getElementById('confirm-ok')
        };

        // Callbacks
        this.callbacks = {
            onScenarioSelect: null,
            onScenarioEdit: null,
            onScenarioDelete: null,
            onAddScenario: null,
            onLoadFile: null,
            onRestart: null,
            onChoice: null,
            onEditorSave: null,
            onThemeChange: null,
            onTypingDelayChange: null,
            onLanguageChange: null,
            onClearData: null,
            onApiKeySave: null,
            onCharacterSave: null,
            onCharacterDelete: null,
            onCharacterEdit: null,
            onStartAiChat: null,
            onAiChatSelect: null,
            onAiChatDelete: null,
            onSendMessage: null
        };

        this._confirmResolve = null;
        this._lastSpeaker = null;
        this._editingCharacterId = null;

        this._bindEvents();
    }

    /**
     * Привязывает обработчики событий
     */
    _bindEvents() {
        // Sidebar
        this.elements.btnMenu.addEventListener('click', () => this.openSidebar());
        this.elements.sidebarClose.addEventListener('click', () => this.closeSidebar());
        this.elements.sidebarOverlay.addEventListener('click', () => this.closeSidebar());

        this.elements.btnAddScenario.addEventListener('click', () => {
            this.callbacks.onAddScenario?.();
        });

        this.elements.btnSettings.addEventListener('click', () => this.openSettings());

        // Chat
        this.elements.btnRestart.addEventListener('click', () => {
            this.callbacks.onRestart?.();
        });

        // Editor Modal
        this.elements.editorClose.addEventListener('click', () => this.closeEditor());
        this.elements.editorCancel.addEventListener('click', () => this.closeEditor());
        this.elements.editorSave.addEventListener('click', () => {
            const source = this.elements.editorTextarea.value;
            this.callbacks.onEditorSave?.(source);
        });
        this.elements.editorTemplate?.addEventListener('click', async () => {
            try {
                const response = await fetch('./scenarios/demo.ink');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const text = await response.text();
                this.elements.editorTextarea.value = text;
                this.elements.editorTextarea.focus();
            } catch (e) {
                console.error('Failed to load template:', e);
            }
        });

        this.elements.editorPaste.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                this.elements.editorTextarea.value = text;
                this.elements.editorTextarea.focus();
            } catch (e) {
                console.error('Failed to read clipboard:', e);
            }
        });

        this.elements.editorLoadFile?.addEventListener('click', () => {
            this.elements.editorFileInput.click();
        });

        this.elements.editorFileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.callbacks.onLoadFile?.(file);
                e.target.value = '';
                this.closeEditor();
            }
        });

        // Settings Modal
        this.elements.settingsClose.addEventListener('click', () => this.closeSettings());

        // Theme selector (radio buttons sync with select)
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.elements.settingsTheme.value = e.target.value;
                this.callbacks.onThemeChange?.(e.target.value);
            });
        });

        this.elements.settingsTheme.addEventListener('change', (e) => {
            this.callbacks.onThemeChange?.(e.target.value);
        });

        // Custom slider for typing min
        this._setupSlider('settings-typing-min', 200, 2000, (value) => {
            const max = parseInt(this.elements.settingsTypingMax.value) || 1600;
            this.callbacks.onTypingDelayChange?.(value, max);
        });

        // Custom slider for typing max
        this._setupSlider('settings-typing-max', 400, 5000, (value) => {
            const min = parseInt(this.elements.settingsTypingMin.value) || 400;
            this.callbacks.onTypingDelayChange?.(min, value);
        });

        this.elements.settingsLanguage.addEventListener('change', (e) => {
            this.callbacks.onLanguageChange?.(e.target.value);
        });
        this.elements.btnClearData.addEventListener('click', () => {
            this.callbacks.onClearData?.();
        });

        // Settings Tabs
        document.querySelectorAll('.settings-tabs__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._switchSettingsTab(btn.dataset.tab);
            });
        });

        // API Keys - save on blur/change
        [this.elements.apiKeyOpenai, this.elements.apiKeyGrok].forEach(input => {
            if (!input) return;
            input.addEventListener('change', () => {
                const provider = input.id.replace('api-key-', '');
                this.callbacks.onApiKeySave?.(provider, input.value.trim());
            });
        });

        // API Key toggle visibility buttons
        document.querySelectorAll('.api-key-field__toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                if (input) {
                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
                        lucide.createIcons();
                    }
                }
            });
        });

        // API Key clear buttons
        document.querySelectorAll('.api-key-field__clear').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                if (input) {
                    input.value = '';
                    const provider = input.id.replace('api-key-', '');
                    this.callbacks.onApiKeySave?.(provider, '');
                }
            });
        });

        // Characters
        this.elements.btnAddCharacter?.addEventListener('click', () => {
            this._openCharacterModal(null);
        });

        const closeCharacterModal = () => {
            this.elements.characterModal.hidden = true;
            this._editingCharacterId = null;
        };

        this.elements.characterCancel?.addEventListener('click', closeCharacterModal);
        this.elements.characterModalCancel?.addEventListener('click', closeCharacterModal);

        this.elements.characterSave?.addEventListener('click', () => {
            const name = this.elements.characterName.value.trim();
            const prompt = this.elements.characterPrompt.value.trim();
            if (!name) return;
            this.callbacks.onCharacterSave?.({
                id: this._editingCharacterId || generateId(),
                name,
                prompt
            });
            this.elements.characterModal.hidden = true;
            this._editingCharacterId = null;
        });

        // Editor Tabs
        document.querySelectorAll('.editor-tabs__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._switchEditorTab(btn.dataset.tab);
            });
        });

        // AI Chat Setup
        this.elements.aiChatCancel?.addEventListener('click', () => this.closeEditor());
        this.elements.aiChatStart?.addEventListener('click', () => {
            const title = this.elements.aiChatTitle.value.trim();
            const charId = this.elements.aiChatCharacter.value;
            const modelValue = this.elements.aiChatModel.value; // "provider:model"
            if (!charId || !modelValue) return;
            const [provider, model] = modelValue.split(':');
            this.callbacks.onStartAiChat?.(charId, provider, model, title);
            this.elements.aiChatTitle.value = '';
            this.closeEditor();
        });

        this.elements.aiChatFixSettings?.addEventListener('click', () => {
            this.closeEditor();
            this.openSettings();
            this._switchSettingsTab('api-keys');
        });

        this.elements.aiChatFixChars?.addEventListener('click', () => {
            this.closeEditor();
            this.openSettings();
            this._switchSettingsTab('characters');
        });

        // Chat Input
        this.elements.btnSend?.addEventListener('click', () => this._sendInputMessage());
        this.elements.chatInputField?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._sendInputMessage();
            }
        });

        // Auto-resize textarea
        this.elements.chatInputField?.addEventListener('input', () => {
            const field = this.elements.chatInputField;
            field.style.height = 'auto';
            field.style.height = Math.min(field.scrollHeight, 120) + 'px';
        });

        // Confirm Modal
        this.elements.confirmCancel.addEventListener('click', () => {
            this._confirmResolve?.(false);
            this.closeConfirm();
        });
        this.elements.confirmOk.addEventListener('click', () => {
            this._confirmResolve?.(true);
            this.closeConfirm();
        });

        // Закрытие модалок по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.elements.editorModal.hidden) this.closeEditor();
                if (!this.elements.settingsModal.hidden) this.closeSettings();
                if (!this.elements.confirmModal.hidden) {
                    this._confirmResolve?.(false);
                    this.closeConfirm();
                }
                if (this.elements.sidebar.classList.contains('is-open')) this.closeSidebar();
            }
        });
    }

    /**
     * Устанавливает callback
     * @param {string} name
     * @param {Function} callback
     */
    on(name, callback) {
        if (name in this.callbacks) {
            this.callbacks[name] = callback;
        }
    }

    // ========================================
    // Sidebar
    // ========================================

    openSidebar() {
        this.elements.sidebar.classList.add('is-open');
        this.elements.sidebarOverlay.classList.add('is-visible');
    }

    closeSidebar() {
        this.elements.sidebar.classList.remove('is-open');
        this.elements.sidebarOverlay.classList.remove('is-visible');
    }

    /**
     * Рендерит список сценариев и AI чатов в sidebar
     * @param {Array} scenarios
     * @param {Array} aiChats
     * @param {Object} currentItem - { type, id }
     */
    renderSidebarList(scenarios, aiChats, currentItem) {
        this.elements.scenarioList.innerHTML = '';

        // Рендерим сценарии
        scenarios.forEach(scenario => {
            const item = document.createElement('div');
            item.className = 'sidebar__item';
            if (currentItem?.type === 'scenario' && scenario.id === currentItem.id) {
                item.classList.add('is-active');
            }

            item.innerHTML = `
                <div class="sidebar__item-icon">
                    ${scenario.isDemo ? '📖' : '💬'}
                </div>
                <div class="sidebar__item-info">
                    <div class="sidebar__item-title">${this._escapeHtml(scenario.title)}</div>
                    <div class="sidebar__item-subtitle">${scenario.isDemo ? 'Demo' : 'Custom'}</div>
                </div>
                ${!scenario.isDemo ? `
                <div class="sidebar__item-actions">
                    <button class="sidebar__item-btn sidebar__item-btn--edit" data-action="edit" aria-label="Edit">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="sidebar__item-btn sidebar__item-btn--delete" data-action="delete" aria-label="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                ` : ''}
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.closest('[data-action]')) {
                    this.callbacks.onScenarioSelect?.(scenario.id);
                    this.closeSidebar();
                }
            });

            item.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.callbacks.onScenarioEdit?.(scenario.id);
            });

            item.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.callbacks.onScenarioDelete?.(scenario.id, scenario.title);
            });

            this.elements.scenarioList.appendChild(item);
        });

        // Рендерим AI чаты
        aiChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'sidebar__item';
            if (currentItem?.type === 'ai-chat' && chat.id === currentItem.id) {
                item.classList.add('is-active');
            }

            item.innerHTML = `
                <div class="sidebar__item-icon">
                    <i data-lucide="bot"></i>
                </div>
                <div class="sidebar__item-info">
                    <div class="sidebar__item-title">${this._escapeHtml(chat.title || chat.characterName)}</div>
                    <div class="sidebar__item-subtitle">${this._escapeHtml(chat.model)}</div>
                </div>
                <div class="sidebar__item-actions">
                    <button class="sidebar__item-btn sidebar__item-btn--delete" data-action="delete-chat" aria-label="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.closest('[data-action]')) {
                    this.callbacks.onAiChatSelect?.(chat.id);
                    this.closeSidebar();
                }
            });

            item.querySelector('[data-action="delete-chat"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.callbacks.onAiChatDelete?.(chat.id, chat.characterName);
            });

            this.elements.scenarioList.appendChild(item);
        });

        lucide.createIcons();
    }

    // ========================================
    // Chat Header
    // ========================================

    /**
     * Устанавливает заголовок чата
     * @param {string} title
     * @param {string} subtitle
     */
    setChatHeader(title, subtitle = '') {
        this.elements.chatTitle.textContent = title;
        this.elements.chatSubtitle.textContent = subtitle;
    }

    /**
     * Показывает/скрывает кнопку restart
     * @param {boolean} visible
     */
    setRestartVisible(visible) {
        this.elements.btnRestart.style.display = visible ? 'flex' : 'none';
    }

    // ========================================
    // Messages
    // ========================================

    /**
     * Очищает область сообщений
     */
    clearMessages() {
        this.elements.messages.innerHTML = '';
        this.elements.choicesContent.innerHTML = '';
        this._lastSpeaker = null;
    }

    /**
     * Добавляет сообщение в чат
     * @param {Object} message - { speaker, text, isPlayer }
     * @param {Object} character - { name, avatar }
     */
    /**
     * Генерирует HTML для аватарки персонажа
     * @param {Object} character - { name, avatar }
     * @returns {string}
     */
    _avatarHtml(character) {
        if (character?.avatar) {
            return `<img src="${this._escapeHtml(character.avatar)}" alt="">`;
        }
        if (character?.name) {
            const initial = character.name.charAt(0).toUpperCase();
            return `<span class="avatar-initial">${this._escapeHtml(initial)}</span>`;
        }
        return '';
    }

    addMessage(message, character) {
        const isPlayer = message.isPlayer;
        const isNewSpeaker = message.speaker !== this._lastSpeaker;

        const messageEl = document.createElement('div');
        messageEl.className = `message message--${isPlayer ? 'player' : 'npc'}`;
        if (!isNewSpeaker) {
            messageEl.classList.add('message--continuation');
        }

        const avatarHtml = isNewSpeaker ? this._avatarHtml(character) : '';

        const nameHtml = isNewSpeaker && character?.name
            ? `<div class="message__name">${this._escapeHtml(character.name)}</div>`
            : '';

        messageEl.innerHTML = `
            <div class="message__avatar">${avatarHtml}</div>
            <div class="message__content">
                ${nameHtml}
                <div class="message__bubble">${this._escapeHtml(message.text)}</div>
            </div>
        `;

        this.elements.messages.appendChild(messageEl);
        this._lastSpeaker = message.speaker;
        this._scrollToBottom();
    }

    /**
     * Показывает typing indicator внутри контейнера сообщений
     * @param {Object} character
     */
    showTyping(character) {
        this.hideTyping();
        const el = document.createElement('div');
        el.className = 'typing-indicator';
        el.id = 'typing-indicator';
        el.innerHTML = `
            <div class="typing-indicator__avatar">${this._avatarHtml(character)}</div>
            <div class="typing-indicator__bubble">
                <span class="typing-indicator__dot"></span>
                <span class="typing-indicator__dot"></span>
                <span class="typing-indicator__dot"></span>
            </div>
        `;
        this.elements.messages.appendChild(el);
        this._scrollToBottom();
    }

    /**
     * Скрывает typing indicator
     */
    hideTyping() {
        const el = document.getElementById('typing-indicator');
        if (el) el.remove();
    }

    // ========================================
    // Choices
    // ========================================

    /**
     * Показывает варианты выбора
     * @param {Array} choices - [{ text, target }]
     */
    showChoices(choices) {
        this.elements.choicesContent.innerHTML = '';

        choices.forEach((choice, index) => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice.text;
            btn.style.animationDelay = `${index * 0.1}s`;

            btn.addEventListener('click', () => {
                this.callbacks.onChoice?.(index);
            });

            this.elements.choicesContent.appendChild(btn);
        });

        // Устанавливаем отступ и скроллим после рендера вариантов
        requestAnimationFrame(() => {
            const choicesHeight = this.elements.choices.offsetHeight;
            const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom')) || 0;
            this.elements.messages.style.paddingBottom = `${choicesHeight + safeAreaBottom + 40}px`;
            this._scrollToBottom();
        });
    }

    /**
     * Скрывает варианты выбора
     */
    hideChoices() {
        this.elements.choicesContent.innerHTML = '';
        this.elements.messages.style.paddingBottom = '';
    }

    // ========================================
    // Empty State
    // ========================================

    /**
     * Показывает пустое состояние
     */
    showEmptyState() {
        this.elements.emptyState.hidden = false;
        this.elements.messages.style.display = 'none';
    }

    /**
     * Скрывает пустое состояние
     */
    hideEmptyState() {
        this.elements.emptyState.hidden = true;
        this.elements.messages.style.display = 'flex';
    }

    // ========================================
    // Editor Modal
    // ========================================

    /**
     * Открывает редактор сценария
     * @param {string} source - Исходный код
     * @param {boolean} isNew - Новый сценарий или редактирование
     */
    openEditor(source = '', isNew = true) {
        if (isNew) {
            this.elements.editorTitle.textContent = t('newChat');
            this.elements.editorTabs.hidden = false;
            this._switchEditorTab('scenario');
        } else {
            this.elements.editorTitle.textContent = t('editScenario');
            this.elements.editorTabs.hidden = true;
            // Show scenario tab directly, hide AI chat tab
            document.getElementById('editor-tab-scenario').classList.add('is-active');
            document.getElementById('editor-tab-ai-chat').classList.remove('is-active');
        }

        this.elements.editorTextarea.value = source;
        this.elements.editorError.hidden = true;
        this.elements.editorTemplate.hidden = !isNew;
        this.elements.editorPaste.hidden = !isNew && !source;
        this.elements.editorLoadFile.hidden = !isNew && !source;
        this.elements.editorModal.hidden = false;

        // Фокус на textarea
        setTimeout(() => {
            this.elements.editorTextarea.focus();
        }, 100);
    }

    /**
     * Закрывает редактор
     */
    closeEditor() {
        this.elements.editorModal.hidden = true;
    }

    /**
     * Показывает ошибку в редакторе
     * @param {string} message
     */
    showEditorError(message) {
        this.elements.editorError.textContent = message;
        this.elements.editorError.hidden = false;
    }

    // ========================================
    // Settings Modal
    // ========================================

    /**
     * Открывает настройки
     */
    openSettings() {
        this.elements.settingsModal.hidden = false;
        this.closeSidebar();
    }

    /**
     * Закрывает настройки
     */
    closeSettings() {
        this.elements.characterModal.hidden = true;
        this.elements.settingsModal.hidden = true;
    }

    /**
     * Устанавливает текущий язык в селекте
     * @param {string} lang
     */
    setLanguage(lang) {
        this.elements.settingsLanguage.value = lang;
    }

    /**
     * Устанавливает значения typing delays в UI
     * @param {number} minDelay
     * @param {number} maxDelay
     */
    setTypingDelays(minDelay, maxDelay) {
        if (this.elements.settingsTypingMin) {
            this.elements.settingsTypingMin.value = minDelay;
            this._updateSliderVisual('settings-typing-min', minDelay, 200, 2000);
        }
        if (this.elements.settingsTypingMax) {
            this.elements.settingsTypingMax.value = maxDelay;
            this._updateSliderVisual('settings-typing-max', maxDelay, 400, 5000);
        }
    }

    /**
     * Устанавливает тему в radio buttons
     * @param {string} theme
     */
    setTheme(theme) {
        this.elements.settingsTheme.value = theme;
        const radio = document.getElementById(`theme-${theme}`);
        if (radio) radio.checked = true;

        if (theme === 'default') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    /**
     * Настраивает интерактивный слайдер
     * @param {string} inputId
     * @param {number} min
     * @param {number} max
     * @param {Function} onChange
     */
    _setupSlider(inputId, min, max, onChange) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const track = input.nextElementSibling;
        if (!track || !track.classList.contains('slider-control__track')) return;

        const fill = track.querySelector('.slider-control__fill');
        const valueDisplay = document.getElementById(`${inputId.replace('settings-', '')}-value`);

        const updateVisual = () => {
            const value = parseInt(input.value);
            const percent = ((value - min) / (max - min)) * 100;
            if (fill) fill.style.width = `${percent}%`;
            if (valueDisplay) valueDisplay.textContent = value;
        };

        const updateFromPosition = (clientX) => {
            const rect = track.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const value = Math.round(min + percent * (max - min));
            const step = parseInt(input.step) || 1;
            input.value = Math.round(value / step) * step;
            updateVisual();
            onChange(parseInt(input.value));
        };

        let isDragging = false;

        // Mouse/touch handlers for dragging
        const startDrag = (e) => {
            isDragging = true;
            track.style.cursor = 'grabbing';
            updateFromPosition(e.clientX || e.touches[0].clientX);
            e.preventDefault();
        };

        const drag = (e) => {
            if (!isDragging) return;
            updateFromPosition(e.clientX || e.touches[0].clientX);
            e.preventDefault();
        };

        const endDrag = () => {
            isDragging = false;
            track.style.cursor = 'pointer';
        };

        // Track interactions
        track.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);

        track.addEventListener('touchstart', startDrag);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', endDrag);

        // Input change handler (for accessibility - keyboard)
        input.addEventListener('input', () => {
            updateVisual();
            onChange(parseInt(input.value));
        });

        // Initial update
        updateVisual();
    }

    /**
     * Обновляет визуал слайдера
     * @param {string} inputId
     * @param {number} value
     * @param {number} min
     * @param {number} max
     */
    _updateSliderVisual(inputId, value, min, max) {
        const fill = document.getElementById(`${inputId.replace('settings-', '')}-fill`);
        const valueDisplay = document.getElementById(`${inputId.replace('settings-', '')}-value`);

        const percent = ((value - min) / (max - min)) * 100;
        if (fill) fill.style.width = `${percent}%`;
        if (valueDisplay) valueDisplay.textContent = value;
    }

    // ========================================
    // Editor Tabs
    // ========================================

    /**
     * Переключает вкладку редактора
     * @param {string} tabName - 'scenario' или 'ai-chat'
     */
    _switchEditorTab(tabName) {
        document.querySelectorAll('.editor-tabs__btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.editor-tab-content').forEach(content => {
            content.classList.toggle('is-active', content.id === `editor-tab-${tabName}`);
        });

        // Show/hide editor utility buttons based on tab
        const isScenario = tabName === 'scenario';
        this.elements.editorTemplate.hidden = !isScenario;
        this.elements.editorPaste.hidden = !isScenario;
        this.elements.editorLoadFile.hidden = !isScenario;

        if (tabName === 'ai-chat') {
            this._populateAiChatSetup();
        }
    }

    /**
     * Заполняет форму настройки AI чата
     * @param {Object} apiKeys
     * @param {Array} characters
     */
    populateAiChatSetup(apiKeys, characters) {
        this._aiChatApiKeys = apiKeys;
        this._aiChatCharacters = characters;
    }

    _populateAiChatSetup() {
        const apiKeys = this._aiChatApiKeys || {};
        const characters = this._aiChatCharacters || [];

        const hasKeys = !!(apiKeys.openai || apiKeys.grok);
        const hasChars = characters.length > 0;

        // Show/hide states
        this.elements.aiChatNoKeys.hidden = hasKeys;
        this.elements.aiChatNoChars.hidden = !hasKeys || hasChars;
        this.elements.aiChatSetup.hidden = !hasKeys || !hasChars;
        this.elements.aiChatFooter.hidden = !hasKeys || !hasChars;

        if (!hasKeys || !hasChars) return;

        // Populate character select
        this.elements.aiChatCharacter.innerHTML = '';
        characters.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            this.elements.aiChatCharacter.appendChild(opt);
        });

        // Populate model select based on available keys
        // Prices: input/output per 1M tokens (USD), sorted cheap → expensive
        const providerGroups = [];
        if (apiKeys.openai) {
            providerGroups.push({
                label: 'OpenAI',
                models: [
                    { value: 'openai:gpt-4.1-nano',  label: 'GPT-4.1 Nano — fast · $0.1/$0.4' },
                    { value: 'openai:gpt-4o-mini',    label: 'GPT-4o Mini — fast · $0.15/$0.6' },
                    { value: 'openai:gpt-4.1-mini',   label: 'GPT-4.1 Mini — balanced · $0.4/$1.6' },
                    { value: 'openai:gpt-4.1',        label: 'GPT-4.1 — smart · $2/$8' },
                ]
            });
        }
        if (apiKeys.grok) {
            providerGroups.push({
                label: 'xAI',
                models: [
                    { value: 'grok:grok-3-mini', label: 'Grok 3 Mini — fast · $0.3/$0.5' },
                    { value: 'grok:grok-3',      label: 'Grok 3 — smart · $3/$15' },
                ]
            });
        }
        this.elements.aiChatModel.innerHTML = '';
        providerGroups.forEach(group => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label;
            group.models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.value;
                opt.textContent = m.label;
                optgroup.appendChild(opt);
            });
            this.elements.aiChatModel.appendChild(optgroup);
        });

        lucide.createIcons();
    }

    // ========================================
    // Chat Input Bar
    // ========================================

    showInputBar() {
        this.elements.chatInput.hidden = false;
        // Add padding to messages for input bar
        requestAnimationFrame(() => {
            const inputHeight = this.elements.chatInput.offsetHeight;
            this.elements.messages.style.paddingBottom = `${inputHeight + 16}px`;
        });
    }

    hideInputBar() {
        this.elements.chatInput.hidden = true;
        this.elements.messages.style.paddingBottom = '';
    }

    setInputEnabled(enabled) {
        this.elements.chatInputField.disabled = !enabled;
        this.elements.btnSend.disabled = !enabled;
    }

    focusInput() {
        this.elements.chatInputField.focus();
    }

    _sendInputMessage() {
        const text = this.elements.chatInputField.value.trim();
        if (!text) return;
        this.elements.chatInputField.value = '';
        this.elements.chatInputField.style.height = 'auto';
        this.callbacks.onSendMessage?.(text);
    }

    // ========================================
    // Settings Tabs
    // ========================================

    /**
     * Переключает вкладку настроек
     * @param {string} tabName
     */
    _switchSettingsTab(tabName) {
        document.querySelectorAll('.settings-tabs__btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.toggle('is-active', content.id === `settings-tab-${tabName}`);
        });
    }

    // ========================================
    // API Keys
    // ========================================

    /**
     * Устанавливает значения API ключей в UI
     * @param {Object} keys - { openai, grok }
     */
    setApiKeys(keys) {
        if (this.elements.apiKeyOpenai && keys.openai) {
            this.elements.apiKeyOpenai.value = keys.openai;
        }
        if (this.elements.apiKeyGrok && keys.grok) {
            this.elements.apiKeyGrok.value = keys.grok;
        }
    }

    // ========================================
    // Characters
    // ========================================

    /**
     * Открывает модалку редактирования/создания персонажа
     * @param {Object|null} char - персонаж для редактирования или null для нового
     */
    _openCharacterModal(char) {
        this._editingCharacterId = char?.id || null;
        this.elements.characterName.value = char?.name || '';
        this.elements.characterPrompt.value = char?.prompt || '';
        this.elements.characterModalTitle.textContent = t(char ? 'editCharacter' : 'addCharacter');
        this.elements.characterModal.hidden = false;
        this.elements.characterName.focus();
    }

    /**
     * Рендерит список персонажей
     * @param {Array} characters - [{ id, name, prompt }]
     */
    renderCharacters(characters) {
        if (!this.elements.charactersList) return;
        this.elements.charactersList.innerHTML = '';

        if (characters.length === 0) {
            this.elements.charactersList.innerHTML = `
                <div class="characters-empty" data-i18n="noCharacters">${t('noCharacters')}</div>
            `;
            return;
        }

        characters.forEach(char => {
            const item = document.createElement('div');
            item.className = 'character-item';

            const initial = char.name.charAt(0).toUpperCase();

            item.innerHTML = `
                <div class="character-item__avatar">${this._escapeHtml(initial)}</div>
                <div class="character-item__info">
                    <div class="character-item__name">${this._escapeHtml(char.name)}</div>
                    <div class="character-item__prompt">${this._escapeHtml(char.prompt || '')}</div>
                </div>
                <div class="character-item__actions">
                    <button class="character-item__btn" data-action="edit" aria-label="Edit">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="character-item__btn character-item__btn--delete" data-action="delete" aria-label="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;

            item.querySelector('[data-action="edit"]').addEventListener('click', () => {
                this._openCharacterModal(char);
            });

            item.querySelector('[data-action="delete"]').addEventListener('click', () => {
                this.callbacks.onCharacterDelete?.(char.id, char.name);
            });

            this.elements.charactersList.appendChild(item);
        });

        lucide.createIcons();
    }

    // ========================================
    // Confirm Modal
    // ========================================

    /**
     * Показывает диалог подтверждения
     * @param {string} title
     * @param {string} message
     * @returns {Promise<boolean>}
     */
    confirm(title, message) {
        return new Promise((resolve) => {
            this._confirmResolve = resolve;
            this.elements.confirmTitle.textContent = title;
            this.elements.confirmMessage.textContent = message;
            this.elements.confirmModal.hidden = false;
        });
    }

    /**
     * Закрывает диалог подтверждения
     */
    closeConfirm() {
        this.elements.confirmModal.hidden = true;
        this._confirmResolve = null;
    }

    // ========================================
    // Helpers
    // ========================================

    /**
     * Прокручивает чат вниз
     */
    _scrollToBottom() {
        requestAnimationFrame(() => {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        });
    }

    /**
     * Экранирует HTML
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

}

export default UIController;
