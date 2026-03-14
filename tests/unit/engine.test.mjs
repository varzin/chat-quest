/**
 * InkEngine unit tests
 * Run: node tests/unit/engine.test.mjs
 */

import { InkEngine } from '../../js/engine.js';
import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

// -- Test fixtures --

function createConfig() {
    return {
        dialog: {
            id: 'test_001',
            title: 'Test Scenario',
            participants: ['npc', 'player']
        },
        characters: {
            npc: { name: 'Alice', color: '#4A90E2' },
            player: { name: 'You', color: '#7ED321' }
        }
    };
}

function createKnots() {
    return {
        start: {
            content: [
                { type: 'text', speaker: 'npc', text: 'Hello there!' },
                { type: 'choice', text: 'Say hi', target: 'greet', suppressEcho: false },
                { type: 'choice', text: 'Leave', target: 'farewell', suppressEcho: true }
            ]
        },
        greet: {
            content: [
                { type: 'text', speaker: 'npc', text: 'Nice to meet you!' },
                { type: 'divert', target: 'END' }
            ]
        },
        farewell: {
            content: [
                { type: 'text', speaker: 'npc', text: 'Goodbye!' },
                { type: 'divert', target: 'END' }
            ]
        }
    };
}

function createVariables() {
    return { speaker: '' };
}

function createEngine(globalSettings = null) {
    return new InkEngine(createConfig(), createKnots(), createVariables(), globalSettings);
}

// -- getCurrentContent tests --

describe('InkEngine - getCurrentContent', () => {
    it('should return text and choices from start knot', () => {
        const engine = createEngine();
        const content = engine.getCurrentContent();
        assert.ok(content.type === 'textWithChoices' || content.type === 'choices');
        assert.ok(content.text.length > 0 || content.choices.length > 0);
        assert.equal(content.choices.length, 2);
        assert.equal(content.choices[0].text, 'Say hi');
        assert.equal(content.choices[1].text, 'Leave');
    });

    it('should follow divert and reach END', () => {
        const engine = createEngine();
        // Navigate to greet knot which has text then -> END
        engine.currentKnot = 'greet';
        engine.currentIndex = 0;

        const content = engine.getCurrentContent();
        assert.equal(content.type, 'text');
        assert.equal(content.data[0].text, 'Nice to meet you!');

        // After text, next call should reach END
        const next = engine.getCurrentContent();
        assert.equal(next.type, 'end');
    });

    it('should return end when isEnded is true', () => {
        const engine = createEngine();
        engine.isEnded = true;
        const content = engine.getCurrentContent();
        assert.equal(content.type, 'end');
    });

    it('should return end for unknown knot', () => {
        const engine = createEngine();
        engine.currentKnot = 'nonexistent';
        const content = engine.getCurrentContent();
        assert.equal(content.type, 'end');
        assert.equal(engine.isEnded, true);
    });
});

// -- makeChoice tests --

describe('InkEngine - makeChoice', () => {
    it('should advance to target knot after choice', () => {
        const engine = createEngine();
        // Get content to set currentIndex to choices
        engine.getCurrentContent();
        // Choose first option (Say hi -> greet)
        engine.makeChoice(0);
        assert.equal(engine.currentKnot, 'greet');
        assert.equal(engine.currentIndex, 0);
    });

    it('should handle END target in choice', () => {
        // Create knots with a choice that goes to END
        const knots = {
            start: {
                content: [
                    { type: 'text', speaker: 'npc', text: 'Choose:' },
                    { type: 'choice', text: 'End it', target: 'END', suppressEcho: false }
                ]
            }
        };
        const engine = new InkEngine(createConfig(), knots, createVariables());
        engine.getCurrentContent();
        engine.makeChoice(0);
        assert.equal(engine.isEnded, true);
    });

    it('should do nothing for invalid choice index', () => {
        const engine = createEngine();
        engine.getCurrentContent();
        const knotBefore = engine.currentKnot;
        engine.makeChoice(99);
        assert.equal(engine.currentKnot, knotBefore);
    });
});

// -- getState / restore tests --

describe('InkEngine - state management', () => {
    it('should round-trip state through getState and restore', () => {
        const engine = createEngine();
        engine.getCurrentContent();
        engine.makeChoice(0); // go to greet
        engine.addMessage({ speaker: 'npc', text: 'Hello' });

        const state = engine.getState();

        const engine2 = createEngine();
        engine2.restore(state);

        assert.equal(engine2.currentKnot, 'greet');
        assert.equal(engine2.currentIndex, 0);
        assert.equal(engine2.displayedMessages.length, 1);
        assert.equal(engine2.displayedMessages[0].text, 'Hello');
    });

    it('should reset to initial state', () => {
        const engine = createEngine();
        engine.getCurrentContent();
        engine.makeChoice(0);
        engine.addMessage({ speaker: 'npc', text: 'Hello' });

        engine.reset();

        assert.equal(engine.currentKnot, 'start');
        assert.equal(engine.currentIndex, 0);
        assert.equal(engine.isEnded, false);
        assert.equal(engine.displayedMessages.length, 0);
    });

    it('should handle restore with null gracefully', () => {
        const engine = createEngine();
        engine.restore(null);
        // Should not throw, state unchanged
        assert.equal(engine.currentKnot, 'start');
    });
});

// -- calculateTypingDelay tests --

describe('InkEngine - calculateTypingDelay', () => {
    it('should respect min bound', () => {
        const engine = createEngine({ typingMinDelay: 500, typingMaxDelay: 2000 });
        // Very short text: 2 chars * 100 = 200, should be clamped to min 500
        const delay = engine.calculateTypingDelay('Hi');
        assert.equal(delay, 500);
    });

    it('should respect max bound', () => {
        const engine = createEngine({ typingMinDelay: 500, typingMaxDelay: 2000 });
        // Very long text: 100 chars * 100 = 10000, should be clamped to max 2000
        const longText = 'A'.repeat(100);
        const delay = engine.calculateTypingDelay(longText);
        assert.equal(delay, 2000);
    });

    it('should scale with text length within bounds', () => {
        const engine = createEngine({ typingMinDelay: 100, typingMaxDelay: 5000 });
        const short = engine.calculateTypingDelay('Hello'); // 5 * 100 = 500
        const long = engine.calculateTypingDelay('Hello World, this is longer'); // 27 * 100 = 2700
        assert.ok(short < long, `Expected ${short} < ${long}`);
        assert.equal(short, 500);
        assert.equal(long, 2700);
    });

    it('should use fallback values when no global settings', () => {
        const engine = createEngine(null);
        // With null globalSettings, falls back to config.ui?.typing || {minDelayMs: 400, maxDelayMs: 1600}
        // calculateTypingDelay reads minDelayMs (400) and maxDelayMs (1600)
        // "Hi" = 2 chars * 100 = 200, clamped to min 400
        const shortDelay = engine.calculateTypingDelay('Hi');
        assert.equal(shortDelay, 400);
        // Long text: 50 chars * 100 = 5000, clamped to max 1600
        const longDelay = engine.calculateTypingDelay('A'.repeat(50));
        assert.equal(longDelay, 1600);
    });
});

// -- isPlayer tests --

describe('InkEngine - isPlayer', () => {
    it('should identify second participant as player', () => {
        const engine = createEngine();
        assert.equal(engine.isPlayer('player'), true);
    });

    it('should identify first participant as not player', () => {
        const engine = createEngine();
        assert.equal(engine.isPlayer('npc'), false);
    });

    it('should always identify "player" string as player', () => {
        // Even if participants list has different IDs
        const config = {
            dialog: {
                id: 'test',
                title: 'Test',
                participants: ['spirit', 'traveler']
            },
            characters: {
                spirit: { name: 'Spirit' },
                traveler: { name: 'Traveler' }
            }
        };
        const engine = new InkEngine(config, createKnots(), createVariables());
        // 'player' always returns true per the isPlayer implementation
        assert.equal(engine.isPlayer('player'), true);
        // Second participant should also be player
        assert.equal(engine.isPlayer('traveler'), true);
        // First participant should not be player
        assert.equal(engine.isPlayer('spirit'), false);
    });
});

// -- additional tests --

describe('InkEngine - misc', () => {
    it('should return correct title', () => {
        const engine = createEngine();
        assert.equal(engine.getTitle(), 'Test Scenario');
    });

    it('should return character info', () => {
        const engine = createEngine();
        const char = engine.getCharacter('npc');
        assert.equal(char.name, 'Alice');
    });

    it('should always allow restart', () => {
        const engine = createEngine();
        assert.equal(engine.allowRestart(), true);
    });
});
