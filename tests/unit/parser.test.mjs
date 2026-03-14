/**
 * Parser unit tests
 * Run: node tests/unit/parser.test.mjs
 */

import { parseScenario, splitSource, parseYaml, validateConfig, parseInk } from '../../js/parser.js';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

// -- Test fixtures --

const VALID_SOURCE = `---
dialog:
  id: "test_001"
  title: "Test Scenario"
  participants: ["npc", "player"]

characters:
  npc:
    name: "Alice"
    color: "#4A90E2"
    avatar: "https://example.com/alice.png"
  player:
    name: "You"
    color: "#7ED321"
    avatar: "https://example.com/you.png"
---

VAR speaker = ""

=== start ===
~ speaker = "npc"
Hello there!

+ [Say hi] -> greet
+ [Leave] -> farewell

=== greet ===
~ speaker = "npc"
Nice to meet you!
-> END

=== farewell ===
~ speaker = "npc"
Goodbye!
-> END
`;

// -- splitSource tests --

describe('splitSource', () => {
    it('should separate YAML and Ink parts', () => {
        const result = splitSource(VALID_SOURCE);
        assert.ok(result.yaml.includes('dialog:'));
        assert.ok(result.yaml.includes('characters:'));
        assert.ok(result.ink.includes('=== start ==='));
        assert.ok(result.ink.includes('VAR speaker'));
    });

    it('should throw on missing delimiters', () => {
        assert.throws(
            () => splitSource('no delimiters here'),
            { message: /missing YAML front matter delimiters/ }
        );
    });

    it('should throw on single delimiter', () => {
        assert.throws(
            () => splitSource('---\nsome content without closing'),
            { message: /missing YAML front matter delimiters/ }
        );
    });
});

// -- parseYaml tests --

describe('parseYaml', () => {
    it('should parse nested objects', () => {
        const yaml = `dialog:\n  id: "test"\n  title: "Hello"`;
        const result = parseYaml(yaml);
        assert.equal(result.dialog.id, 'test');
        assert.equal(result.dialog.title, 'Hello');
    });

    it('should parse inline arrays', () => {
        const yaml = `items: ["a", "b", "c"]`;
        const result = parseYaml(yaml);
        assert.deepEqual(result.items, ['a', 'b', 'c']);
    });

    it('should parse quoted strings', () => {
        const yaml = `name: "Hello World"\nother: 'Single quotes'`;
        const result = parseYaml(yaml);
        assert.equal(result.name, 'Hello World');
        assert.equal(result.other, 'Single quotes');
    });

    it('should parse numbers and booleans', () => {
        const yaml = `count: 42\npi: 3.14\nenabled: true\ndisabled: false`;
        const result = parseYaml(yaml);
        assert.equal(result.count, 42);
        assert.equal(result.pi, 3.14);
        assert.equal(result.enabled, true);
        assert.equal(result.disabled, false);
    });

    it('should skip comments and empty lines', () => {
        const yaml = `# This is a comment\n\nname: "Test"`;
        const result = parseYaml(yaml);
        assert.equal(result.name, 'Test');
    });
});

// -- validateConfig tests --

describe('validateConfig', () => {
    it('should accept valid config', () => {
        const config = {
            dialog: { id: 'test', participants: ['npc', 'player'] },
            characters: {
                npc: { name: 'NPC' },
                player: { name: 'Player' }
            }
        };
        const result = validateConfig(config);
        assert.equal(result.valid, true);
    });

    it('should reject missing dialog', () => {
        const result = validateConfig({});
        assert.equal(result.valid, false);
        assert.ok(result.error.includes('dialog'));
    });

    it('should reject wrong participant count', () => {
        const config = {
            dialog: { id: 'test', participants: ['npc'] },
            characters: { npc: { name: 'NPC' } }
        };
        const result = validateConfig(config);
        assert.equal(result.valid, false);
        assert.ok(result.error.includes('exactly 2'));
    });

    it('should reject missing character definition', () => {
        const config = {
            dialog: { id: 'test', participants: ['npc', 'player'] },
            characters: { npc: { name: 'NPC' } }
        };
        const result = validateConfig(config);
        assert.equal(result.valid, false);
        assert.ok(result.error.includes('player'));
    });

    it('should reject missing characters section', () => {
        const config = {
            dialog: { id: 'test', participants: ['npc', 'player'] }
        };
        const result = validateConfig(config);
        assert.equal(result.valid, false);
        assert.ok(result.error.includes('characters'));
    });
});

// -- parseInk tests --

describe('parseInk', () => {
    it('should parse VAR declarations', () => {
        const ink = `VAR speaker = ""\nVAR score = 0\n\n=== start ===\nHello`;
        const result = parseInk(ink, ['npc', 'player']);
        assert.equal(result.variables.speaker, '');
        assert.equal(result.variables.score, 0);
    });

    it('should parse knots', () => {
        const ink = `=== start ===\nHello\n\n=== other ===\nWorld`;
        const result = parseInk(ink, ['npc', 'player']);
        assert.ok(result.knots.start);
        assert.ok(result.knots.other);
    });

    it('should parse choices with brackets (suppressEcho false)', () => {
        const ink = `=== start ===\n+ [Say hello] -> greet`;
        const result = parseInk(ink, ['npc', 'player']);
        const choice = result.knots.start.content[0];
        assert.equal(choice.type, 'choice');
        assert.equal(choice.text, 'Say hello');
        assert.equal(choice.target, 'greet');
        assert.equal(choice.suppressEcho, false);
    });

    it('should parse choices without brackets (suppressEcho true)', () => {
        const ink = `=== start ===\n+ Leave now -> exit`;
        const result = parseInk(ink, ['npc', 'player']);
        const choice = result.knots.start.content[0];
        assert.equal(choice.type, 'choice');
        assert.equal(choice.text, 'Leave now');
        assert.equal(choice.target, 'exit');
        assert.equal(choice.suppressEcho, true);
    });

    it('should parse diverts', () => {
        const ink = `=== start ===\nHello\n-> other\n\n=== other ===\nWorld`;
        const result = parseInk(ink, ['npc', 'player']);
        const content = result.knots.start.content;
        assert.equal(content[0].type, 'text');
        assert.equal(content[1].type, 'divert');
        assert.equal(content[1].target, 'other');
    });

    it('should parse -> END as divert', () => {
        const ink = `=== start ===\nHello\n-> END`;
        const result = parseInk(ink, ['npc', 'player']);
        const content = result.knots.start.content;
        const divert = content.find(c => c.type === 'divert');
        assert.equal(divert.target, 'END');
    });

    it('should parse speaker assignment', () => {
        const ink = `=== start ===\n~ speaker = "npc"\nHello from NPC`;
        const result = parseInk(ink, ['npc', 'player']);
        const textItem = result.knots.start.content[0];
        assert.equal(textItem.type, 'text');
        assert.equal(textItem.speaker, 'npc');
        assert.equal(textItem.text, 'Hello from NPC');
    });

    it('should link choice on one line to divert on next line', () => {
        const ink = `=== start ===\n+ [Go]\n    -> target\n\n=== target ===\nArrived`;
        const result = parseInk(ink, ['npc', 'player']);
        const choice = result.knots.start.content.find(c => c.type === 'choice');
        assert.equal(choice.text, 'Go');
        assert.equal(choice.target, 'target');
    });
});

// -- parseScenario (integration) tests --

describe('parseScenario', () => {
    it('should parse a valid scenario completely', () => {
        const result = parseScenario(VALID_SOURCE);
        assert.ok(result.config);
        assert.ok(result.knots);
        assert.ok(result.variables);
        assert.equal(result.config.dialog.id, 'test_001');
        assert.equal(result.config.dialog.title, 'Test Scenario');
        assert.ok(result.knots.start);
        assert.ok(result.knots.greet);
        assert.ok(result.knots.farewell);
    });

    it('should throw on missing start knot', () => {
        const source = `---
dialog:
  id: "test"
  title: "Test"
  participants: ["npc", "player"]

characters:
  npc:
    name: "NPC"
  player:
    name: "Player"
---

=== not_start ===
Hello
-> END
`;
        assert.throws(
            () => parseScenario(source),
            { message: /Missing required knot: start/ }
        );
    });

    it('should throw on invalid config', () => {
        const source = `---
dialog:
  id: "test"
---

=== start ===
Hello
`;
        assert.throws(
            () => parseScenario(source),
            { message: /participants/ }
        );
    });
});
