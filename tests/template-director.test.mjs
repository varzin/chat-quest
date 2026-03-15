/**
 * Template Director unit tests
 * Run: node tests/template-director.test.mjs
 */

import { selectArchetype, getDirective, getArchetype, listArchetypes } from '../js/template-director.js';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

describe('Template Director', () => {

    describe('listArchetypes', () => {
        it('should return all 6 archetypes', () => {
            const archetypes = listArchetypes();
            assert.equal(archetypes.length, 6);
            assert.ok(archetypes.includes('SHORT_REACTION'));
            assert.ok(archetypes.includes('STORY'));
            assert.ok(archetypes.includes('INITIATIVE'));
            assert.ok(archetypes.includes('OBSERVATION'));
            assert.ok(archetypes.includes('OPINION'));
            assert.ok(archetypes.includes('TEASE'));
        });
    });

    describe('getArchetype', () => {
        it('should return archetype object with directive', () => {
            const arch = getArchetype('STORY');
            assert.ok(arch);
            assert.ok(arch.directive.ru);
            assert.ok(arch.directive.en);
            assert.deepEqual(arch.sentenceRange, [3, 5]);
            assert.equal(arch.allowQuestion, false);
        });

        it('should return null for unknown archetype', () => {
            assert.equal(getArchetype('NONEXISTENT'), null);
        });
    });

    describe('getDirective', () => {
        it('should return Russian directive by default', () => {
            const directive = getDirective('SHORT_REACTION', 'ru');
            assert.ok(directive.includes('ОДНИМ'));
        });

        it('should return English directive', () => {
            const directive = getDirective('SHORT_REACTION', 'en');
            assert.ok(directive.includes('ONE'));
        });

        it('should return empty string for unknown archetype', () => {
            assert.equal(getDirective('UNKNOWN', 'ru'), '');
        });
    });

    describe('selectArchetype - question detection', () => {
        it('should select OPINION when user asks a question with ?', () => {
            const messages = [
                { text: 'Привет', isPlayer: true }
            ];
            const result = selectArchetype(messages, 'Что ты думаешь об этом?');
            assert.equal(result, 'OPINION');
        });

        it('should select OPINION for English question', () => {
            const messages = [
                { text: 'Hi', isPlayer: true }
            ];
            const result = selectArchetype(messages, 'What do you think?');
            assert.equal(result, 'OPINION');
        });

        it('should select OPINION for question starting with question word', () => {
            const messages = [];
            const result = selectArchetype(messages, 'Как ты относишься к дождю');
            assert.equal(result, 'OPINION');
        });

        it('should avoid repeating OPINION if last was OPINION', () => {
            const messages = [
                { text: 'Question 1', isPlayer: true },
                { text: 'Answer 1', isPlayer: false, archetype: 'OPINION' },
                { text: 'Question 2', isPlayer: true }
            ];
            const result = selectArchetype(messages, 'Почему так?');
            assert.notEqual(result, 'OPINION');
        });
    });

    describe('selectArchetype - short messages', () => {
        it('should select SHORT_REACTION or TEASE for 1-word message', () => {
            const messages = [];
            const result = selectArchetype(messages, 'Ладно');
            assert.ok(
                ['SHORT_REACTION', 'TEASE', 'OBSERVATION'].includes(result),
                `Expected short-type archetype, got ${result}`
            );
        });

        it('should select short archetype for 3-word message', () => {
            const messages = [];
            const result = selectArchetype(messages, 'Ну хорошо ладно');
            assert.ok(
                ['SHORT_REACTION', 'TEASE', 'OBSERVATION'].includes(result),
                `Expected short-type archetype, got ${result}`
            );
        });

        it('should avoid repeating last archetype for short messages', () => {
            const messages = [
                { text: 'Ok', isPlayer: true },
                { text: 'React', isPlayer: false, archetype: 'SHORT_REACTION' },
                { text: 'Sure', isPlayer: true }
            ];
            const result = selectArchetype(messages, 'Ага');
            assert.notEqual(result, 'SHORT_REACTION');
        });
    });

    describe('selectArchetype - long messages', () => {
        it('should select STORY, OBSERVATION, or OPINION for long message', () => {
            const messages = [];
            const longText = 'Сегодня я ходил в парк и видел там очень красивые цветы которые растут только весной и мне стало так хорошо на душе что я решил остаться там подольше и почитать книгу';
            const result = selectArchetype(messages, longText);
            assert.ok(
                ['STORY', 'OBSERVATION', 'OPINION'].includes(result),
                `Expected long-type archetype, got ${result}`
            );
        });
    });

    describe('selectArchetype - rotation', () => {
        it('should not repeat the same archetype twice in a row', () => {
            const messages = [];
            const archetypes = [];

            // Simulate 10 exchanges with medium-length messages
            for (let i = 0; i < 10; i++) {
                const userText = 'Это обычное сообщение средней длины для теста';
                messages.push({ text: userText, isPlayer: true });

                const archetype = selectArchetype(messages, userText);
                archetypes.push(archetype);

                messages.push({ text: 'Ответ бота', isPlayer: false, archetype });
            }

            // Check no two consecutive are the same
            for (let i = 1; i < archetypes.length; i++) {
                assert.notEqual(
                    archetypes[i], archetypes[i - 1],
                    `Archetype repeated at position ${i}: ${archetypes[i]}`
                );
            }
        });

        it('should produce variety across 6 exchanges', () => {
            const messages = [];
            const archetypeSet = new Set();

            for (let i = 0; i < 12; i++) {
                const userText = 'Нормальное среднее сообщение для проверки';
                messages.push({ text: userText, isPlayer: true });

                const archetype = selectArchetype(messages, userText);
                archetypeSet.add(archetype);

                messages.push({ text: 'Ответ', isPlayer: false, archetype });
            }

            // Should use at least 4 different archetypes in 12 exchanges
            assert.ok(
                archetypeSet.size >= 4,
                `Expected at least 4 unique archetypes, got ${archetypeSet.size}: ${[...archetypeSet]}`
            );
        });
    });
});
