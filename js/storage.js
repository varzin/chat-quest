'use strict';

/**
 * Модуль для работы с localStorage
 */

const STORAGE_KEYS = {
    SCENARIOS: 'chatquest_scenarios',
    PROGRESS: 'chatquest_progress',
    SETTINGS: 'chatquest_settings',
    CURRENT: 'chatquest_current'
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
    if (getCurrentScenarioId() === id) {
        setCurrentScenarioId(null);
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

/**
 * Получает ID текущего сценария
 * @returns {string|null}
 */
export function getCurrentScenarioId() {
    return safeGet(STORAGE_KEYS.CURRENT);
}

/**
 * Устанавливает текущий сценарий
 * @param {string|null} id
 */
export function setCurrentScenarioId(id) {
    safeSet(STORAGE_KEYS.CURRENT, id);
}

// ========================================
// Настройки
// ========================================

/**
 * Получает настройки
 * @returns {Object}
 */
export function getSettings() {
    return safeGet(STORAGE_KEYS.SETTINGS) || { language: null };
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
// Очистка данных
// ========================================

/**
 * Полностью очищает все данные приложения
 */
export function clearAllData() {
    try {
        // Удаляем все сценарии
        const list = getScenarioList();
        list.forEach(s => {
            localStorage.removeItem(`scenario_${s.id}`);
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
    getCurrentScenarioId,
    setCurrentScenarioId,
    getSettings,
    saveSettings,
    clearAllData
};
