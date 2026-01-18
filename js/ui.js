'use strict';

import { t } from './i18n.js';

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
            btnLoadFile: document.getElementById('btn-load-file'),
            fileInput: document.getElementById('file-input'),
            btnSettings: document.getElementById('btn-settings'),

            // Chat
            btnMenu: document.getElementById('btn-menu'),
            btnRestart: document.getElementById('btn-restart'),
            chatTitle: document.getElementById('chat-title'),
            chatSubtitle: document.getElementById('chat-subtitle'),
            messages: document.getElementById('messages'),
            typingIndicator: document.getElementById('typing-indicator'),
            typingAvatar: document.getElementById('typing-avatar'),
            choices: document.getElementById('choices'),
            emptyState: document.getElementById('empty-state'),

            // Editor Modal
            editorModal: document.getElementById('editor-modal'),
            editorTitle: document.getElementById('editor-title'),
            editorTextarea: document.getElementById('editor-textarea'),
            editorError: document.getElementById('editor-error'),
            editorClose: document.getElementById('editor-close'),
            editorCancel: document.getElementById('editor-cancel'),
            editorSave: document.getElementById('editor-save'),
            editorPaste: document.getElementById('editor-paste'),

            // Settings Modal
            settingsModal: document.getElementById('settings-modal'),
            settingsClose: document.getElementById('settings-close'),
            settingsLanguage: document.getElementById('settings-language'),
            btnClearData: document.getElementById('btn-clear-data'),

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
            onLanguageChange: null,
            onClearData: null
        };

        this._confirmResolve = null;

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

        this.elements.btnLoadFile.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.callbacks.onLoadFile?.(file);
                e.target.value = '';
            }
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
        this.elements.editorPaste.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                this.elements.editorTextarea.value = text;
                this.elements.editorTextarea.focus();
            } catch (e) {
                console.error('Failed to read clipboard:', e);
            }
        });

        // Settings Modal
        this.elements.settingsClose.addEventListener('click', () => this.closeSettings());
        this.elements.settingsLanguage.addEventListener('change', (e) => {
            this.callbacks.onLanguageChange?.(e.target.value);
        });
        this.elements.btnClearData.addEventListener('click', () => {
            this.callbacks.onClearData?.();
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
     * Рендерит список сценариев в sidebar
     * @param {Array} scenarios
     * @param {string} currentId
     */
    renderScenarioList(scenarios, currentId) {
        this.elements.scenarioList.innerHTML = '';

        scenarios.forEach(scenario => {
            const item = document.createElement('div');
            item.className = 'sidebar__item';
            if (scenario.id === currentId) {
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="sidebar__item-btn sidebar__item-btn--delete" data-action="delete" aria-label="Delete">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
                ` : ''}
            `;

            // Клик по элементу (выбор сценария)
            item.addEventListener('click', (e) => {
                if (!e.target.closest('[data-action]')) {
                    this.callbacks.onScenarioSelect?.(scenario.id);
                    this.closeSidebar();
                }
            });

            // Кнопки действий
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
        this.elements.choices.innerHTML = '';
    }

    /**
     * Добавляет сообщение в чат
     * @param {Object} message - { speaker, text, isPlayer }
     * @param {Object} character - { name, color, avatar }
     */
    addMessage(message, character) {
        const isPlayer = message.isPlayer;

        const messageEl = document.createElement('div');
        messageEl.className = `message message--${isPlayer ? 'player' : 'npc'}`;

        const avatarHtml = character?.avatar
            ? `<img src="${this._escapeHtml(character.avatar)}" alt="">`
            : '';

        const nameHtml = character?.name
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
        this._scrollToBottom();
    }

    /**
     * Показывает typing indicator
     * @param {Object} character
     */
    showTyping(character) {
        const avatarHtml = character?.avatar
            ? `<img src="${this._escapeHtml(character.avatar)}" alt="">`
            : '';

        this.elements.typingAvatar.innerHTML = avatarHtml;
        this.elements.typingIndicator.hidden = false;
        this._scrollToBottom();
    }

    /**
     * Скрывает typing indicator
     */
    hideTyping() {
        this.elements.typingIndicator.hidden = true;
    }

    // ========================================
    // Choices
    // ========================================

    /**
     * Показывает варианты выбора
     * @param {Array} choices - [{ text, target }]
     */
    showChoices(choices) {
        this.elements.choices.innerHTML = '';

        choices.forEach((choice, index) => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice.text;
            btn.style.animationDelay = `${index * 0.1}s`;

            btn.addEventListener('click', () => {
                this.callbacks.onChoice?.(index);
            });

            this.elements.choices.appendChild(btn);
        });
    }

    /**
     * Скрывает варианты выбора
     */
    hideChoices() {
        this.elements.choices.innerHTML = '';
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
        this.elements.editorTitle.textContent = t(isNew ? 'newScenario' : 'editScenario');
        this.elements.editorTextarea.value = source;
        this.elements.editorError.hidden = true;
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
        this.elements.settingsModal.hidden = true;
    }

    /**
     * Устанавливает текущий язык в селекте
     * @param {string} lang
     */
    setLanguage(lang) {
        this.elements.settingsLanguage.value = lang;
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
            const lastMessage = this.elements.messages.lastElementChild;
            if (lastMessage) {
                lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
            } else {
                this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
            }
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
