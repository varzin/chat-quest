'use strict';

/**
 * Chat Quest - Main Application Module
 */

import { initI18n, setLanguage, getLanguage, t, updatePageTranslations } from './i18n.js';
import * as storage from './storage.js';
import { parseScenario, generateId } from './parser.js';
import InkEngine from './engine.js';
import UIController from './ui.js';

// Demo scenario (embedded)
const DEMO_SCENARIO = `---
dialog:
  id: "demo_meeting"
  title: "Таинственный незнакомец"
  participants: ["stranger", "player"]

characters:
  stranger:
    name: "Незнакомец"
    color: "#4A90E2"
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=stranger&backgroundColor=1c1c1e"
  player:
    name: "Вы"
    color: "#7ED321"
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=player&backgroundColor=1c1c1e"

ui:
  typing:
    minDelayMs: 400
    maxDelayMs: 1800
  allowRestart: true
---

VAR speaker = ""

=== start ===
~ speaker = "stranger"
Привет, путник.

Я заметил тебя издалека. Ты выглядишь потерянным.

+ [Кто вы?]
    -> who_are_you
+ [Мне нужна помощь]
    -> need_help
+ [Я просто гуляю]
    -> just_walking

=== who_are_you ===
~ speaker = "player"
Кто вы такой?

~ speaker = "stranger"
Меня зовут по-разному. Странник. Хранитель перекрёстков. Или просто... друг.

Это зависит от того, что тебе нужно.

+ [Мне нужен совет]
    -> advice_path
+ [Мне ничего не нужно]
    -> nothing_needed

=== need_help ===
~ speaker = "player"
Мне нужна помощь.

~ speaker = "stranger"
Тогда ты пришёл по адресу.

Что тебя беспокоит?

+ [Я заблудился]
    -> lost_path
+ [Я ищу что-то важное]
    -> searching_path

=== just_walking ===
~ speaker = "player"
Я просто гуляю. Наслаждаюсь тишиной.

~ speaker = "stranger"
Хороший ответ. Немногие ценят тишину в наши дни.

Тогда не буду тебя задерживать. Приятной прогулки.

~ speaker = "player"
Спасибо. И вам хорошего дня.

-> END

=== advice_path ===
~ speaker = "player"
Мне нужен совет.

~ speaker = "stranger"
Совет... Хорошо.

Вот что я скажу: не бойся сворачивать с протоптанных дорог. Иногда лучшие открытия ждут там, где никто не ходит.

~ speaker = "player"
Я запомню это. Спасибо.

~ speaker = "stranger"
Удачи тебе, путник.

-> END

=== nothing_needed ===
~ speaker = "player"
Мне ничего не нужно. Я справлюсь сам.

~ speaker = "stranger"
Независимость — хорошее качество. Но помни: просить помощи — не слабость.

До встречи, путник.

-> END

=== lost_path ===
~ speaker = "player"
Я заблудился. Не знаю, куда идти.

~ speaker = "stranger"
Заблудиться — первый шаг к тому, чтобы найти себя.

Видишь ту тропу на востоке? Она приведёт тебя к деревне. Там ты найдёшь еду и ночлег.

~ speaker = "player"
Спасибо! Я пойду туда.

~ speaker = "stranger"
Береги себя.

-> END

=== searching_path ===
~ speaker = "player"
Я ищу что-то важное. Но не могу понять, что именно.

~ speaker = "stranger"
Многие ищут, не зная что. Это называется путешествием.

Может быть, ты ищешь не вещь, а ответ? Или человека?

+ [Я ищу ответы]
    -> seeking_answers
+ [Я ищу кого-то]
    -> seeking_someone

=== seeking_answers ===
~ speaker = "player"
Я ищу ответы на свои вопросы.

~ speaker = "stranger"
Тогда продолжай идти вперёд. Ответы приходят к тем, кто не останавливается.

И помни: иногда вопрос важнее ответа.

~ speaker = "player"
Я подумаю об этом. Прощайте.

~ speaker = "stranger"
До свидания, искатель.

-> END

=== seeking_someone ===
~ speaker = "player"
Я ищу кого-то. Человека, которого потерял.

~ speaker = "stranger"
Потери... Они делают нас сильнее или ломают.

Если этот человек хочет быть найденным — ты найдёшь его. Если нет... тогда, возможно, тебе нужно найти себя.

~ speaker = "player"
Вы правы. Мне нужно время, чтобы это осознать.

~ speaker = "stranger"
Время у тебя есть. Удачи в поисках.

-> END
`;

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

        // Устанавливаем язык в селекте настроек
        this.ui.setLanguage(getLanguage());
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
                const { config } = parseScenario(DEMO_SCENARIO);
                storage.saveScenario(
                    config.dialog.id,
                    config.dialog.title,
                    DEMO_SCENARIO,
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

            this.engine = new InkEngine(config, knots, variables);
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
            const choiceText = content.choices[index].text;
            const playerChar = this.engine.getCharacter(
                this.engine.config.dialog.participants[1]
            );

            const message = {
                speaker: this.engine.config.dialog.participants[1],
                text: choiceText,
                isPlayer: true
            };

            this.ui.addMessage(message, playerChar);
            this.engine.addMessage(message);
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

            // Если редактировали текущий сценарий, перезагружаем его
            if (id === this.currentScenarioId) {
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
