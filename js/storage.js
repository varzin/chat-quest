'use strict';

/**
 * Модуль для работы с localStorage
 */

const KEYS = {
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
        console.error(`Storage read error for "${key}":`, e);
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

/**
 * Обновляет или добавляет элемент в список в localStorage
 * @param {string} storageKey - ключ списка в localStorage
 * @param {Object} item - элемент для сохранения
 * @param {string} idField - имя поля-идентификатора
 */
function _updateListItem(storageKey, item, idField = 'id') {
    const list = safeGet(storageKey) || [];
    const idx = list.findIndex(entry => entry[idField] === item[idField]);
    if (idx >= 0) {
        list[idx] = item;
    } else {
        list.push(item);
    }
    safeSet(storageKey, list);
}

/**
 * Безопасное удаление из localStorage
 * @param {string} key
 */
function safeRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error(`Storage delete error for "${key}":`, e);
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
    return safeGet(KEYS.SCENARIOS) || [];
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
    safeSet(`scenario_${id}`, source);
    _updateListItem(KEYS.SCENARIOS, { id, title, isDemo });
}

/**
 * Удаляет сценарий
 * @param {string} id
 */
export function deleteScenario(id) {
    safeRemove(`scenario_${id}`);
    deleteProgress(id);

    // Обновляем список
    const list = getScenarioList().filter(s => s.id !== id);
    safeSet(KEYS.SCENARIOS, list);

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
    const allProgress = safeGet(KEYS.PROGRESS) || {};
    return allProgress[scenarioId] || null;
}

/**
 * Сохраняет прогресс сценария
 * @param {string} scenarioId
 * @param {Object} progress - { currentKnot, messages, variables }
 */
export function saveProgress(scenarioId, progress) {
    const allProgress = safeGet(KEYS.PROGRESS) || {};
    allProgress[scenarioId] = progress;
    safeSet(KEYS.PROGRESS, allProgress);
}

/**
 * Удаляет прогресс сценария
 * @param {string} scenarioId
 */
export function deleteProgress(scenarioId) {
    const allProgress = safeGet(KEYS.PROGRESS) || {};
    delete allProgress[scenarioId];
    safeSet(KEYS.PROGRESS, allProgress);
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
    return safeGet(KEYS.SETTINGS) || {
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
    safeSet(KEYS.SETTINGS, { ...current, ...settings });
}

// ========================================
// API Ключи
// ========================================

/**
 * Получает сохранённые API ключи
 * @returns {Object} - { openai: string|null, grok: string|null }
 */
export function getApiKeys() {
    return safeGet(KEYS.API_KEYS) || { openai: null, grok: null };
}

/**
 * Сохраняет API ключ для провайдера
 * @param {string} provider - 'openai' или 'grok'
 * @param {string|null} key
 */
export function saveApiKey(provider, key) {
    const keys = getApiKeys();
    keys[provider] = key || null;
    safeSet(KEYS.API_KEYS, keys);
}

// ========================================
// Персонажи
// ========================================

/**
 * Получает список персонажей
 * @returns {Array<{id: string, name: string, prompt: string}>}
 */
export function getCharacters() {
    return safeGet(KEYS.CHARACTERS) || [];
}

/**
 * Сохраняет персонажа (создание или обновление)
 * @param {Object} character - { id, name, prompt }
 */
export function saveCharacter(character) {
    _updateListItem(KEYS.CHARACTERS, character);
}

/**
 * Удаляет персонажа
 * @param {string} id
 */
export function deleteCharacter(id) {
    const list = getCharacters().filter(c => c.id !== id);
    safeSet(KEYS.CHARACTERS, list);
}

// ========================================
// AI Чаты
// ========================================

/**
 * Получает список AI чатов (метаданные)
 * @returns {Array}
 */
export function getAiChatList() {
    return safeGet(KEYS.AI_CHATS) || [];
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
    _updateListItem(KEYS.AI_CHATS, {
        id,
        characterName: data.characterName,
        characterId: data.characterId,
        provider: data.provider,
        model: data.model
    });
}

/**
 * Удаляет AI чат
 * @param {string} id
 */
export function deleteAiChat(id) {
    safeRemove(`aichat_${id}`);

    const list = getAiChatList().filter(c => c.id !== id);
    safeSet(KEYS.AI_CHATS, list);

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
    const val = safeGet(KEYS.CURRENT);
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
    safeSet(KEYS.CURRENT, item);
}

// ========================================
// Очистка данных
// ========================================

/**
 * Полностью очищает все данные приложения
 */
export function clearAllData() {
    const scenarios = getScenarioList();
    scenarios.forEach(s => safeRemove(`scenario_${s.id}`));

    const aiChats = getAiChatList();
    aiChats.forEach(c => safeRemove(`aichat_${c.id}`));

    Object.values(KEYS).forEach(key => safeRemove(key));
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
