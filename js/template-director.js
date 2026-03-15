'use strict';

/**
 * Template Director - выбирает архетип ответа для AI-модели.
 *
 * Вместо абстрактных правил ("варьируй длину", "проявляй инициативу")
 * даёт модели КОНКРЕТНЫЙ шаблон-архетип с жёсткими ограничениями.
 * Маленькие модели (grok-3-mini) плохо следуют абстрактным инструкциям,
 * но отлично заполняют конкретные формы.
 *
 * Архетипы:
 * - SHORT_REACTION: 1 предложение, без вопроса, без действия. Реакция на слова собеседника.
 * - STORY: 3-5 предложений, личное воспоминание или история по теме.
 * - INITIATIVE: 1-2 предложения, предложить конкретное действие или активность.
 * - OBSERVATION: 1-2 предложения, заметить что-то в окружении или в собеседнике.
 * - OPINION: 2-3 предложения, поделиться мнением или мыслью по теме.
 * - TEASE: 1 предложение, шутливый комментарий или лёгкая подколка.
 */

/**
 * @typedef {'SHORT_REACTION'|'STORY'|'INITIATIVE'|'OBSERVATION'|'OPINION'|'TEASE'} ArchetypeName
 */

/**
 * Полный набор архетипов с описаниями на двух языках.
 * Каждый архетип содержит:
 * - directive: инструкция для модели (ru/en)
 * - sentenceRange: [min, max] предложений
 * - allowQuestion: можно ли заканчивать вопросом
 */
const ARCHETYPES = {
    SHORT_REACTION: {
        directive: {
            ru: 'Ответь ОДНИМ коротким предложением. Это реакция на слова собеседника — удивление, согласие, эмоция. Без вопросов. Без действий. Просто отреагируй.',
            en: 'Reply with ONE short sentence. This is a reaction to what was said — surprise, agreement, emotion. No questions. No actions. Just react.'
        },
        sentenceRange: [1, 1],
        allowQuestion: false
    },
    STORY: {
        directive: {
            ru: 'Расскажи короткую историю или воспоминание, связанное с темой разговора. 3-5 предложений. Начни с "Помню..." или "У меня был случай..." или подобного. Не задавай вопросов в конце.',
            en: 'Share a short story or memory related to the topic. 3-5 sentences. Start with "I remember..." or "Once I..." or similar. Do not ask questions at the end.'
        },
        sentenceRange: [3, 5],
        allowQuestion: false
    },
    INITIATIVE: {
        directive: {
            ru: 'Предложи конкретное действие или активность. 1-2 предложения. Например: "Давай сходим...", "А что если мы...", "Хочу показать тебе...". Будь конкретным — место, время, действие.',
            en: 'Propose a specific action or activity. 1-2 sentences. For example: "Let\'s go to...", "What if we...", "I want to show you...". Be specific — place, time, action.'
        },
        sentenceRange: [1, 2],
        allowQuestion: false
    },
    OBSERVATION: {
        directive: {
            ru: 'Заметь что-то в окружении, в собеседнике или в ситуации. 1-2 предложения. Например: "Ты сегодня выглядишь...", "Тут так тихо...", "Интересно, что...". Наблюдение, не вопрос.',
            en: 'Notice something about the surroundings, the other person, or the situation. 1-2 sentences. For example: "You look...", "It\'s so quiet here...", "It\'s interesting that...". An observation, not a question.'
        },
        sentenceRange: [1, 2],
        allowQuestion: false
    },
    OPINION: {
        directive: {
            ru: 'Поделись своим мнением или мыслью по теме разговора. 2-3 предложения. Выскажи позицию, объясни почему так думаешь. Не спрашивай мнение собеседника.',
            en: 'Share your opinion or thought on the topic. 2-3 sentences. State your position, explain why you think so. Do not ask for the other person\'s opinion.'
        },
        sentenceRange: [2, 3],
        allowQuestion: false
    },
    TEASE: {
        directive: {
            ru: 'Пошути или слегка подколи собеседника. ОДНО предложение. Лёгкий, игривый тон. Без вопросов.',
            en: 'Make a joke or lightly tease. ONE sentence. Light, playful tone. No questions.'
        },
        sentenceRange: [1, 1],
        allowQuestion: false
    }
};

/**
 * Порядок архетипов для ротации (сбалансированный цикл).
 * Гарантирует разнообразие: не будет двух одинаковых подряд.
 */
const ROTATION_SEQUENCE = [
    'OPINION',
    'SHORT_REACTION',
    'STORY',
    'TEASE',
    'INITIATIVE',
    'SHORT_REACTION',
    'OBSERVATION',
    'OPINION',
    'TEASE',
    'STORY',
    'INITIATIVE',
    'OBSERVATION'
];

/**
 * Определяет архетип на основе контекста разговора.
 *
 * Логика выбора (приоритеты):
 * 1. Если пользователь задал прямой вопрос -> OPINION (ответить по сути)
 * 2. Если пользователь написал очень коротко (1-3 слова) -> SHORT_REACTION или TEASE
 * 3. Если пользователь поделился чем-то личным (длинное сообщение) -> STORY или OBSERVATION
 * 4. Если последние 2+ ответа были одного типа -> принудительная смена
 * 5. Фолбэк -> ротация по ROTATION_SEQUENCE
 *
 * @param {Array<{text: string, isPlayer: boolean, archetype?: string}>} messages
 * @param {string} userText - текущее сообщение пользователя
 * @returns {ArchetypeName}
 */
export function selectArchetype(messages, userText) {
    const recentArchetypes = _getRecentArchetypes(messages, 3);

    // 1. Пользователь задал вопрос -> дать мнение (не вопрос в ответ!)
    if (_isQuestion(userText)) {
        const pick = _avoidRepeat('OPINION', recentArchetypes);
        return pick;
    }

    // 2. Очень короткое сообщение (1-3 слова) -> короткая реакция или подколка
    const wordCount = userText.trim().split(/\s+/).length;
    if (wordCount <= 3) {
        const options = ['SHORT_REACTION', 'TEASE', 'OBSERVATION'];
        return _pickFromOptions(options, recentArchetypes);
    }

    // 3. Длинное сообщение (>20 слов) -> история или наблюдение
    if (wordCount > 20) {
        const options = ['STORY', 'OBSERVATION', 'OPINION'];
        return _pickFromOptions(options, recentArchetypes);
    }

    // 4. Среднее сообщение -> ротация
    return _rotateArchetype(recentArchetypes, messages.length);
}

/**
 * Возвращает директиву для выбранного архетипа.
 * @param {ArchetypeName} archetype
 * @param {'ru'|'en'} lang
 * @returns {string}
 */
export function getDirective(archetype, lang = 'ru') {
    const arch = ARCHETYPES[archetype];
    if (!arch) return '';
    return arch.directive[lang] || arch.directive['en'];
}

/**
 * Возвращает полный объект архетипа.
 * @param {ArchetypeName} archetype
 * @returns {Object|null}
 */
export function getArchetype(archetype) {
    return ARCHETYPES[archetype] || null;
}

/**
 * Возвращает список всех доступных архетипов.
 * @returns {ArchetypeName[]}
 */
export function listArchetypes() {
    return Object.keys(ARCHETYPES);
}

// ============================================================
// Внутренние функции
// ============================================================

/**
 * Извлекает последние N архетипов из истории сообщений AI.
 * @param {Array<{isPlayer: boolean, archetype?: string}>} messages
 * @param {number} count
 * @returns {string[]}
 */
function _getRecentArchetypes(messages, count) {
    const result = [];
    for (let i = messages.length - 1; i >= 0 && result.length < count; i--) {
        if (!messages[i].isPlayer && messages[i].archetype) {
            result.unshift(messages[i].archetype);
        }
    }
    return result;
}

/**
 * Проверяет, является ли текст вопросом.
 * @param {string} text
 * @returns {boolean}
 */
function _isQuestion(text) {
    const trimmed = text.trim();
    if (trimmed.endsWith('?')) return true;

    // Русские вопросительные слова
    const ruPatterns = /^(как|что|где|когда|почему|зачем|кто|куда|откуда|сколько|какой|какая|какое|какие|чем|ли)\b/i;
    // Английские вопросительные слова
    const enPatterns = /^(how|what|where|when|why|who|which|do|does|did|is|are|was|were|can|could|would|will|shall|have|has)\b/i;

    return ruPatterns.test(trimmed) || enPatterns.test(trimmed);
}

/**
 * Выбирает архетип, избегая повторения последнего.
 * @param {string} preferred
 * @param {string[]} recentArchetypes
 * @returns {ArchetypeName}
 */
function _avoidRepeat(preferred, recentArchetypes) {
    const last = recentArchetypes[recentArchetypes.length - 1];
    if (last !== preferred) return preferred;

    // Если совпадает с последним, берём следующий из ротации
    const idx = ROTATION_SEQUENCE.indexOf(preferred);
    const next = ROTATION_SEQUENCE[(idx + 1) % ROTATION_SEQUENCE.length];
    return next;
}

/**
 * Выбирает из списка опций тот, который не повторяет последний.
 * @param {string[]} options
 * @param {string[]} recentArchetypes
 * @returns {ArchetypeName}
 */
function _pickFromOptions(options, recentArchetypes) {
    const last = recentArchetypes[recentArchetypes.length - 1];
    for (const opt of options) {
        if (opt !== last) return opt;
    }
    return options[0];
}

/**
 * Ротация по заданной последовательности.
 * @param {string[]} recentArchetypes
 * @param {number} messageCount - общее количество сообщений
 * @returns {ArchetypeName}
 */
function _rotateArchetype(recentArchetypes, messageCount) {
    // Считаем количество AI-ответов (примерно половина сообщений)
    const aiCount = Math.floor(messageCount / 2);
    const idx = aiCount % ROTATION_SEQUENCE.length;
    const candidate = ROTATION_SEQUENCE[idx];

    // Проверяем, не совпадает ли с последним
    const last = recentArchetypes[recentArchetypes.length - 1];
    if (candidate === last) {
        return ROTATION_SEQUENCE[(idx + 1) % ROTATION_SEQUENCE.length];
    }

    return candidate;
}
