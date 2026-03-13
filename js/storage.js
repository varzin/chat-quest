'use strict';

/**
 * Модуль для работы с localStorage
 */

const STORAGE_KEYS = {
    SCENARIOS: 'chatquest_scenarios',
    PROGRESS: 'chatquest_progress',
    SETTINGS: 'chatquest_settings',
    CURRENT: 'chatquest_current',
    API_KEYS: 'chatquest_api_keys',
    CHARACTERS: 'chatquest_characters',
    AI_CHATS: 'chatquest_ai_chats'
};

/**
 * Безопасное чтение из localStorage
 * @param {string} key
 * @returns {any}
 */
function safeGet(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Storage read error:', e);
        return null;
    }
}

/**
 * Безопасная запись в localStorage
 * @param {string} key
 * @param {any} value
 */
function safeSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Storage write error:', e);
    }
}

// ========================================
// Сценарии
// ========================================

/**
 * Получает список всех сохранённых сценариев (метаданные)
 * @returns {Array<{id: string, title: string, isDemo: boolean}>}
 */
export function getScenarioList() {
    return safeGet(STORAGE_KEYS.SCENARIOS) || [];
}

/**
 * Получает исходный код сценария по ID
 * @param {string} id
 * @returns {string|null}
 */
export function getScenarioSource(id) {
    return safeGet(`scenario_${id}`);
}

/**
 * Сохраняет сценарий
 * @param {string} id
 * @param {string} title
 * @param {string} source
 * @param {boolean} isDemo
 */
export function saveScenario(id, title, source, isDemo = false) {
    // Сохраняем исходный код
    safeSet(`scenario_${id}`, source);

    // Обновляем список сценариев
    const list = getScenarioList();
    const existingIndex = list.findIndex(s => s.id === id);

    const scenarioMeta = { id, title, isDemo };

    if (existingIndex >= 0) {
        list[existingIndex] = scenarioMeta;
    } else {
        list.push(scenarioMeta);
    }

    safeSet(STORAGE_KEYS.SCENARIOS, list);
}

/**
 * Удаляет сценарий
 * @param {string} id
 */
export function deleteScenario(id) {
    // Удаляем исходный код
    try {
        localStorage.removeItem(`scenario_${id}`);
    } catch (e) {
        console.error('Storage delete error:', e);
    }

    // Удаляем прогресс
    deleteProgress(id);

    // Обновляем список
    const list = getScenarioList().filter(s => s.id !== id);
    safeSet(STORAGE_KEYS.SCENARIOS, list);

    // Если это был текущий сценарий, сбрасываем
    const current = getCurrentItem();
    if (current?.type === 'scenario' && current?.id === id) {
        setCurrentItem(null);
    }
}

// ========================================
// Прогресс
// ========================================

/**
 * Получает сохранённый прогресс сценария
 * @param {string} scenarioId
 * @returns {Object|null} - { currentKnot, messages, variables }
 */
export function getProgress(scenarioId) {
    const allProgress = safeGet(STORAGE_KEYS.PROGRESS) || {};
    return allProgress[scenarioId] || null;
}

/**
 * Сохраняет прогресс сценария
 * @param {string} scenarioId
 * @param {Object} progress - { currentKnot, messages, variables }
 */
export function saveProgress(scenarioId, progress) {
    const allProgress = safeGet(STORAGE_KEYS.PROGRESS) || {};
    allProgress[scenarioId] = progress;
    safeSet(STORAGE_KEYS.PROGRESS, allProgress);
}

/**
 * Удаляет прогресс сценария
 * @param {string} scenarioId
 */
export function deleteProgress(scenarioId) {
    const allProgress = safeGet(STORAGE_KEYS.PROGRESS) || {};
    delete allProgress[scenarioId];
    safeSet(STORAGE_KEYS.PROGRESS, allProgress);
}

// ========================================
// Текущий сценарий
// ========================================

// ========================================
// Настройки
// ========================================

/**
 * Получает настройки
 * @returns {Object}
 */
export function getSettings() {
    return safeGet(STORAGE_KEYS.SETTINGS) || {
        language: null,
        theme: 'default',
        typingMinDelay: 400,
        typingMaxDelay: 1600
    };
}

/**
 * Сохраняет настройки
 * @param {Object} settings
 */
export function saveSettings(settings) {
    const current = getSettings();
    safeSet(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
}

// ========================================
// API Ключи
// ========================================

/**
 * Получает сохранённые API ключи
 * @returns {Object} - { openai: string|null, grok: string|null }
 */
export function getApiKeys() {
    return safeGet(STORAGE_KEYS.API_KEYS) || { openai: null, grok: null };
}

/**
 * Сохраняет API ключ для провайдера
 * @param {string} provider - 'openai' или 'grok'
 * @param {string|null} key
 */
export function saveApiKey(provider, key) {
    const keys = getApiKeys();
    keys[provider] = key || null;
    safeSet(STORAGE_KEYS.API_KEYS, keys);
}

// ========================================
// Персонажи
// ========================================

/**
 * Получает список персонажей
 * @returns {Array<{id: string, name: string, prompt: string}>}
 */
export function getCharacters() {
    return safeGet(STORAGE_KEYS.CHARACTERS) || [];
}

/**
 * Сохраняет персонажа (создание или обновление)
 * @param {Object} character - { id, name, prompt }
 */
export function saveCharacter(character) {
    const list = getCharacters();
    const idx = list.findIndex(c => c.id === character.id);
    if (idx >= 0) {
        list[idx] = character;
    } else {
        list.push(character);
    }
    safeSet(STORAGE_KEYS.CHARACTERS, list);
}

/**
 * Удаляет персонажа
 * @param {string} id
 */
export function deleteCharacter(id) {
    const list = getCharacters().filter(c => c.id !== id);
    safeSet(STORAGE_KEYS.CHARACTERS, list);
}

// ========================================
// AI Чаты
// ========================================

/**
 * Получает список AI чатов (метаданные)
 * @returns {Array}
 */
export function getAiChatList() {
    return safeGet(STORAGE_KEYS.AI_CHATS) || [];
}

/**
 * Получает полные данные AI чата
 * @param {string} id
 * @returns {Object|null}
 */
export function getAiChat(id) {
    return safeGet(`aichat_${id}`);
}

/**
 * Сохраняет AI чат
 * @param {string} id
 * @param {Object} data - { characterId, characterName, provider, model, messages }
 */
export function saveAiChat(id, data) {
    safeSet(`aichat_${id}`, data);

    // Обновляем список
    const list = getAiChatList();
    const idx = list.findIndex(c => c.id === id);
    const meta = {
        id,
        characterName: data.characterName,
        characterId: data.characterId,
        provider: data.provider,
        model: data.model
    };
    if (idx >= 0) {
        list[idx] = meta;
    } else {
        list.push(meta);
    }
    safeSet(STORAGE_KEYS.AI_CHATS, list);
}

/**
 * Удаляет AI чат
 * @param {string} id
 */
export function deleteAiChat(id) {
    try {
        localStorage.removeItem(`aichat_${id}`);
    } catch (e) {
        console.error('Storage delete error:', e);
    }

    const list = getAiChatList().filter(c => c.id !== id);
    safeSet(STORAGE_KEYS.AI_CHATS, list);

    const current = getCurrentItem();
    if (current?.type === 'ai-chat' && current?.id === id) {
        setCurrentItem(null);
    }
}

// ========================================
// Текущий элемент (сценарий или AI чат)
// ========================================

/**
 * Получает текущий активный элемент
 * @returns {{type: string, id: string}|null}
 */
export function getCurrentItem() {
    const val = safeGet(STORAGE_KEYS.CURRENT);
    if (!val) return null;
    // Обратная совместимость: старый формат - просто строка ID
    if (typeof val === 'string') return { type: 'scenario', id: val };
    return val;
}

/**
 * Устанавливает текущий элемент
 * @param {{type: string, id: string}|null} item
 */
export function setCurrentItem(item) {
    safeSet(STORAGE_KEYS.CURRENT, item);
}

// ========================================
// Очистка данных
// ========================================

/**
 * Полностью очищает все данные приложения
 */
export function clearAllData() {
    try {
        // Удаляем все сценарии
        const scenarios = getScenarioList();
        scenarios.forEach(s => {
            localStorage.removeItem(`scenario_${s.id}`);
        });

        // Удаляем все AI чаты
        const aiChats = getAiChatList();
        aiChats.forEach(c => {
            localStorage.removeItem(`aichat_${c.id}`);
        });

        // Удаляем основные ключи
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    } catch (e) {
        console.error('Storage clear error:', e);
    }
}

export default {
    getScenarioList,
    getScenarioSource,
    saveScenario,
    deleteScenario,
    getProgress,
    saveProgress,
    deleteProgress,
    getCurrentItem,
    setCurrentItem,
    getSettings,
    saveSettings,
    getApiKeys,
    saveApiKey,
    getCharacters,
    saveCharacter,
    deleteCharacter,
    getAiChatList,
    getAiChat,
    saveAiChat,
    deleteAiChat,
    clearAllData
};
