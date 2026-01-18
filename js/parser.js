'use strict';

/**
 * Парсер YAML front matter + Ink сценариев
 * Без внешних библиотек
 */

/**
 * Разделяет файл на YAML и Ink части
 * @param {string} source
 * @returns {{yaml: string, ink: string}}
 */
function splitSource(source) {
    const lines = source.split('\n');

    // Ищем открывающий ---
    let yamlStart = -1;
    let yamlEnd = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            if (yamlStart === -1) {
                yamlStart = i;
            } else {
                yamlEnd = i;
                break;
            }
        }
    }

    if (yamlStart === -1 || yamlEnd === -1) {
        throw new Error('Invalid format: missing YAML front matter delimiters (---)');
    }

    const yaml = lines.slice(yamlStart + 1, yamlEnd).join('\n');
    const ink = lines.slice(yamlEnd + 1).join('\n').trim();

    return { yaml, ink };
}

/**
 * Простой парсер YAML (поддерживает только нужный подсет)
 * @param {string} yamlStr
 * @returns {Object}
 */
function parseYaml(yamlStr) {
    const result = {};
    const lines = yamlStr.split('\n');
    const stack = [{ obj: result, indent: -1 }];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Пропускаем пустые строки и комментарии
        if (line.trim() === '' || line.trim().startsWith('#')) {
            continue;
        }

        // Определяем уровень отступа
        const indent = line.search(/\S/);
        const content = line.trim();

        // Возвращаемся к нужному уровню в стеке
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        const current = stack[stack.length - 1].obj;

        // Парсим строку
        if (content.startsWith('- ')) {
            // Элемент массива
            const value = parseYamlValue(content.slice(2));
            if (!Array.isArray(current)) {
                // Преобразуем в массив
                const parent = stack[stack.length - 2]?.obj;
                const key = stack[stack.length - 1].key;
                if (parent && key) {
                    parent[key] = [value];
                    stack[stack.length - 1].obj = parent[key];
                }
            } else {
                current.push(value);
            }
        } else if (content.includes(':')) {
            // Ключ: значение
            const colonIndex = content.indexOf(':');
            const key = content.slice(0, colonIndex).trim();
            const valueStr = content.slice(colonIndex + 1).trim();

            if (valueStr === '' || valueStr === '|' || valueStr === '>') {
                // Вложенный объект или массив
                current[key] = {};
                stack.push({ obj: current[key], indent, key });
            } else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
                // Инлайн массив ["a", "b"]
                current[key] = parseInlineArray(valueStr);
            } else {
                // Простое значение
                current[key] = parseYamlValue(valueStr);
            }
        }
    }

    return result;
}

/**
 * Парсит значение YAML (строка, число, boolean)
 * @param {string} str
 * @returns {any}
 */
function parseYamlValue(str) {
    str = str.trim();

    // Убираем кавычки
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
    }

    // Boolean
    if (str === 'true') return true;
    if (str === 'false') return false;

    // Null
    if (str === 'null' || str === '~') return null;

    // Число
    if (/^-?\d+$/.test(str)) return parseInt(str, 10);
    if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);

    return str;
}

/**
 * Парсит инлайн массив ["a", "b"]
 * @param {string} str
 * @returns {Array}
 */
function parseInlineArray(str) {
    // Убираем скобки
    str = str.slice(1, -1).trim();
    if (str === '') return [];

    const result = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true;
            quoteChar = char;
        } else if (inQuotes && char === quoteChar) {
            inQuotes = false;
        } else if (!inQuotes && char === ',') {
            result.push(parseYamlValue(current.trim()));
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        result.push(parseYamlValue(current.trim()));
    }

    return result;
}

/**
 * Валидирует YAML конфигурацию сценария
 * @param {Object} config
 * @returns {{valid: boolean, error?: string}}
 */
function validateConfig(config) {
    // Проверяем dialog
    if (!config.dialog) {
        return { valid: false, error: 'Missing required field: dialog' };
    }
    if (!config.dialog.id) {
        return { valid: false, error: 'Missing required field: dialog.id' };
    }
    if (!config.dialog.participants || !Array.isArray(config.dialog.participants)) {
        return { valid: false, error: 'Missing required field: dialog.participants' };
    }
    if (config.dialog.participants.length !== 2) {
        return { valid: false, error: 'dialog.participants must have exactly 2 elements' };
    }

    // Проверяем characters
    if (!config.characters) {
        return { valid: false, error: 'Missing required field: characters' };
    }

    for (const participantId of config.dialog.participants) {
        if (!config.characters[participantId]) {
            return { valid: false, error: `Missing character definition: ${participantId}` };
        }
        const char = config.characters[participantId];
        if (!char.name) {
            return { valid: false, error: `Missing name for character: ${participantId}` };
        }
    }

    return { valid: true };
}

/**
 * Парсит Ink-сценарий
 * @param {string} inkStr
 * @param {Array<string>} participants
 * @returns {Object}
 */
function parseInk(inkStr, participants) {
    const knots = {};
    const variables = {};

    const lines = inkStr.split('\n');
    let currentKnot = null;
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Пропускаем пустые строки
        if (trimmed === '') continue;

        // VAR объявление
        if (trimmed.startsWith('VAR ')) {
            const match = trimmed.match(/^VAR\s+(\w+)\s*=\s*(.*)$/);
            if (match) {
                variables[match[1]] = parseYamlValue(match[2]);
            }
            continue;
        }

        // Knot определение (=== name ===)
        if (trimmed.startsWith('===')) {
            // Сохраняем предыдущий knot
            if (currentKnot) {
                knots[currentKnot] = parseKnotContent(currentContent, participants);
            }

            // Начинаем новый knot
            const match = trimmed.match(/^===\s*(\w+)\s*===?$/);
            if (match) {
                currentKnot = match[1];
                currentContent = [];
            }
            continue;
        }

        // Добавляем строку к текущему knot
        if (currentKnot) {
            currentContent.push(line);
        }
    }

    // Сохраняем последний knot
    if (currentKnot) {
        knots[currentKnot] = parseKnotContent(currentContent, participants);
    }

    return { knots, variables };
}

/**
 * Парсит содержимое одного knot
 * @param {string[]} lines
 * @param {string[]} participants
 * @returns {Object}
 */
function parseKnotContent(lines, participants) {
    const content = [];
    let currentSpeaker = null;
    let lastChoice = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') continue;

        // Speaker assignment: ~ speaker = "npc"
        if (trimmed.startsWith('~')) {
            const match = trimmed.match(/^~\s*speaker\s*=\s*["']?(\w+)["']?$/);
            if (match) {
                currentSpeaker = match[1];
            }
            continue;
        }

        // Choice: + [Text] или + Text
        if (trimmed.startsWith('+')) {
            const choice = parseChoice(trimmed);
            if (choice) {
                const choiceItem = { type: 'choice', ...choice };
                content.push(choiceItem);
                // Запоминаем последний choice чтобы связать с divert
                lastChoice = choiceItem;
            }
            continue;
        }

        // Divert: -> knot_name или -> END
        if (trimmed.startsWith('->')) {
            const target = trimmed.slice(2).trim();
            // Если есть предыдущий choice без target, связываем divert с ним
            if (lastChoice && !lastChoice.target) {
                lastChoice.target = target;
            } else {
                // Иначе добавляем как отдельный divert
                content.push({ type: 'divert', target });
                lastChoice = null;
            }
            continue;
        }

        // Обычный текст (реплика) - сбрасываем lastChoice
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
            content.push({
                type: 'text',
                speaker: currentSpeaker,
                text: trimmed
            });
            lastChoice = null;
        }
    }

    return { content };
}

/**
 * Парсит строку choice
 * @param {string} line
 * @returns {Object|null}
 */
function parseChoice(line) {
    const trimmed = line.trim();

    // + [Text] -> target
    // + [Text]
    //     -> target (на следующей строке - обрабатывается отдельно)

    let text = '';
    let target = null;

    // Формат: + [Text] -> target (в скобках = не показывать как сообщение)
    const bracketMatch = trimmed.match(/^\+\s*\[(.*?)\]\s*(?:->\s*(\w+))?$/);
    if (bracketMatch) {
        text = bracketMatch[1].trim();
        target = bracketMatch[2] || null;
        return { text, target, suppressEcho: true };
    }

    // Формат: + Text -> target (без скобок = показывать как сообщение)
    const simpleMatch = trimmed.match(/^\+\s*(.*?)\s*(?:->\s*(\w+))?$/);
    if (simpleMatch) {
        text = simpleMatch[1].trim();
        target = simpleMatch[2] || null;
        return { text, target, suppressEcho: false };
    }

    return null;
}

/**
 * Основная функция парсинга сценария
 * @param {string} source - Исходный код сценария (YAML + Ink)
 * @returns {{config: Object, knots: Object, variables: Object}}
 */
export function parseScenario(source) {
    // Разделяем на части
    const { yaml, ink } = splitSource(source);

    // Парсим YAML
    const config = parseYaml(yaml);

    // Валидируем
    const validation = validateConfig(config);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Парсим Ink
    const { knots, variables } = parseInk(ink, config.dialog.participants);

    // Проверяем наличие start knot
    if (!knots.start) {
        throw new Error('Missing required knot: start');
    }

    return { config, knots, variables };
}

/**
 * Генерирует уникальный ID для сценария
 * @returns {string}
 */
export function generateId() {
    return 'scenario_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default { parseScenario, generateId };
