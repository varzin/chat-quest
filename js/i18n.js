'use strict';

/**
 * Локализация приложения (RU/EN)
 */

const translations = {
    ru: {
        // Sidebar
        scenarios: 'Сценарии',
        addScenario: 'Добавить сценарий',
        loadFile: 'Загрузить файл',
        settings: 'Настройки',

        // Chat
        noScenario: 'Выберите сценарий из меню',
        endOfScenario: 'Конец сценария',

        // Editor
        editScenario: 'Редактировать сценарий',
        newScenario: 'Новый сценарий',
        save: 'Сохранить',
        cancel: 'Отмена',
        paste: 'Вставить',
        editorPlaceholder: 'YAML + Ink код сценария...',

        // Settings
        theme: 'Тема',
        themeDefault: 'Стандартная',
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

        // Misc
        player: 'Игрок',
        untitled: 'Без названия'
    },

    en: {
        // Sidebar
        scenarios: 'Scenarios',
        addScenario: 'Add scenario',
        loadFile: 'Load file',
        settings: 'Settings',

        // Chat
        noScenario: 'Select a scenario from the menu',
        endOfScenario: 'End of scenario',

        // Editor
        editScenario: 'Edit scenario',
        newScenario: 'New scenario',
        save: 'Save',
        cancel: 'Cancel',
        paste: 'Paste',
        editorPlaceholder: 'YAML + Ink scenario code...',

        // Settings
        theme: 'Theme',
        themeDefault: 'Default',
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
