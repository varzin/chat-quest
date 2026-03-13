'use strict';

/**
 * Локализация приложения (RU/EN)
 */

const translations = {
    ru: {
        // Sidebar
        scenarios: 'Сценарии',
        chats: 'Чаты',
        newChat: 'Новый чат',
        addScenario: 'Добавить сценарий',
        loadFile: 'Загрузить файл',
        settings: 'Настройки',

        // Chat
        noScenario: 'Выберите сценарий из меню',
        endOfScenario: 'Конец сценария',

        // Editor
        editScenario: 'Редактировать сценарий',
        newScenario: 'Новый сценарий',
        tabScenario: 'Сценарий',
        tabAiChat: 'AI Чат',
        save: 'Сохранить',
        cancel: 'Отмена',
        paste: 'Вставить',
        useTemplate: 'Шаблон',
        editorPlaceholder: 'YAML + Ink код сценария...',

        // Settings
        theme: 'Тема',
        themeDefault: 'Стандартная',
        themeNeutral: 'Нейтральная',
        themeLowContrast: 'Низкий контраст',
        language: 'Язык',
        typingSpeed: 'Скорость печати',
        typingMin: 'Мин (мс)',
        typingMax: 'Макс (мс)',
        clearData: 'Очистить все данные',

        // Confirmations
        confirm: 'Подтвердить',
        confirmRestart: 'Начать сценарий сначала?',
        confirmDelete: 'Удалить сценарий "{title}"?',
        confirmClearData: 'Удалить все сценарии и прогресс?',

        // Errors
        parseError: 'Ошибка парсинга сценария',
        invalidFormat: 'Неверный формат файла',
        missingField: 'Отсутствует обязательное поле: {field}',

        // Demo
        demoTitle: 'Демо: Встреча',

        // Settings Tabs
        settingsGeneral: 'Основные',
        settingsApiKeys: 'API Ключи',
        settingsCharacters: 'Персонажи',

        // API Keys
        apiKeyOpenai: 'OpenAI',
        apiKeyGrok: 'Grok (xAI)',
        apiKeyPlaceholder: 'Вставьте API ключ...',
        apiKeySaved: 'Ключ сохранён',
        apiKeyRemoved: 'Ключ удалён',

        // Characters
        addCharacter: 'Добавить персонажа',
        characterName: 'Имя',
        characterNamePlaceholder: 'Имя персонажа...',
        characterPrompt: 'Системный промпт',
        characterPromptPlaceholder: 'Опишите характер и поведение персонажа...',
        saveCharacter: 'Сохранить',
        editCharacter: 'Редактировать',
        deleteCharacter: 'Удалить',
        noCharacters: 'Нет персонажей',
        confirmDeleteCharacter: 'Удалить персонажа "{name}"?',
        confirmDeleteChat: 'Удалить чат с "{name}"?',
        confirmRestartChat: 'Очистить историю чата?',

        // AI Chat Setup
        chatTitle: 'Название чата',
        chatTitlePlaceholder: 'Необязательно...',
        selectCharacter: 'Персонаж',
        selectModel: 'Модель',
        modelPriceHint: 'Цена: ввод / вывод за 1M токенов, USD',
        startChat: 'Начать чат',
        noApiKeys: 'API ключи не настроены',
        fixInSettings: 'Настроить',
        noCharactersHint: 'Создайте персонажа в настройках',
        messagePlaceholder: 'Сообщение...',

        // Misc
        player: 'Игрок',
        untitled: 'Без названия'
    },

    en: {
        // Sidebar
        scenarios: 'Scenarios',
        chats: 'Chats',
        newChat: 'New chat',
        addScenario: 'Add scenario',
        loadFile: 'Load file',
        settings: 'Settings',

        // Chat
        noScenario: 'Select a scenario from the menu',
        endOfScenario: 'End of scenario',

        // Editor
        editScenario: 'Edit scenario',
        newScenario: 'New scenario',
        tabScenario: 'Scenario',
        tabAiChat: 'AI Chat',
        save: 'Save',
        cancel: 'Cancel',
        paste: 'Paste',
        useTemplate: 'Template',
        editorPlaceholder: 'YAML + Ink scenario code...',

        // Settings
        theme: 'Theme',
        themeDefault: 'Default',
        themeNeutral: 'Neutral',
        themeLowContrast: 'Low contrast',
        language: 'Language',
        typingSpeed: 'Typing speed',
        typingMin: 'Min (ms)',
        typingMax: 'Max (ms)',
        clearData: 'Clear all data',

        // Confirmations
        confirm: 'Confirm',
        confirmRestart: 'Restart scenario from beginning?',
        confirmDelete: 'Delete scenario "{title}"?',
        confirmClearData: 'Delete all scenarios and progress?',

        // Errors
        parseError: 'Scenario parsing error',
        invalidFormat: 'Invalid file format',
        missingField: 'Missing required field: {field}',

        // Demo
        demoTitle: 'Demo: The Meeting',

        // Settings Tabs
        settingsGeneral: 'General',
        settingsApiKeys: 'API Keys',
        settingsCharacters: 'Characters',

        // API Keys
        apiKeyOpenai: 'OpenAI',
        apiKeyGrok: 'Grok (xAI)',
        apiKeyPlaceholder: 'Paste API key...',
        apiKeySaved: 'Key saved',
        apiKeyRemoved: 'Key removed',

        // Characters
        addCharacter: 'Add character',
        characterName: 'Name',
        characterNamePlaceholder: 'Character name...',
        characterPrompt: 'System prompt',
        characterPromptPlaceholder: 'Describe the character\'s personality and behavior...',
        saveCharacter: 'Save',
        editCharacter: 'Edit',
        deleteCharacter: 'Delete',
        noCharacters: 'No characters',
        confirmDeleteCharacter: 'Delete character "{name}"?',
        confirmDeleteChat: 'Delete chat with "{name}"?',
        confirmRestartChat: 'Clear chat history?',

        // AI Chat Setup
        chatTitle: 'Chat title',
        chatTitlePlaceholder: 'Optional...',
        selectCharacter: 'Character',
        selectModel: 'Model',
        modelPriceHint: 'Price: input / output per 1M tokens, USD',
        startChat: 'Start chat',
        noApiKeys: 'No API keys configured',
        fixInSettings: 'Fix in settings',
        noCharactersHint: 'Create a character in Settings',
        messagePlaceholder: 'Message...',

        // Misc
        player: 'Player',
        untitled: 'Untitled'
    }
};

let currentLanguage = 'ru';

/**
 * Устанавливает текущий язык
 * @param {string} lang - Код языка ('ru' или 'en')
 */
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        updatePageTranslations();
    }
}

/**
 * Возвращает текущий язык
 * @returns {string}
 */
export function getLanguage() {
    return currentLanguage;
}

/**
 * Получает перевод по ключу
 * @param {string} key - Ключ перевода
 * @param {Object} params - Параметры для подстановки
 * @returns {string}
 */
export function t(key, params = {}) {
    let text = translations[currentLanguage]?.[key] || translations['ru'][key] || key;

    // Подстановка параметров {param}
    Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });

    return text;
}

/**
 * Обновляет все элементы с атрибутом data-i18n на странице
 */
export function updatePageTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // Обновляем placeholder у textarea
    const editorTextarea = document.getElementById('editor-textarea');
    if (editorTextarea) {
        editorTextarea.placeholder = t('editorPlaceholder');
    }

    // Обновляем title для иконочных кнопок в editor header
    const editorPaste = document.getElementById('editor-paste');
    if (editorPaste) {
        editorPaste.title = t('paste');
    }

    const editorLoadFile = document.getElementById('editor-load-file');
    if (editorLoadFile) {
        editorLoadFile.title = t('loadFile');
    }

    const editorTemplate = document.getElementById('editor-template');
    if (editorTemplate) {
        editorTemplate.title = t('useTemplate');
    }

    // Обновляем placeholder для API ключей
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

/**
 * Инициализирует модуль локализации
 * @param {string} savedLanguage - Сохранённый язык из storage
 */
export function initI18n(savedLanguage) {
    if (savedLanguage && translations[savedLanguage]) {
        currentLanguage = savedLanguage;
    } else {
        // Определяем язык браузера
        const browserLang = navigator.language?.slice(0, 2);
        if (browserLang === 'ru') {
            currentLanguage = 'ru';
        } else {
            currentLanguage = 'en';
        }
    }

    updatePageTranslations();
}

export default { setLanguage, getLanguage, t, updatePageTranslations, initI18n };
