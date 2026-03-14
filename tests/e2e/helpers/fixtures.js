/**
 * Test scenario fixtures in YAML front matter + Ink format.
 *
 * Each fixture is a complete, valid scenario string that can be injected
 * into localStorage via the injectScenario() helper.
 */

/**
 * SIMPLE_SCENARIO
 * 2 knots, 1 choice, reaches END quickly.
 * NPC says hello, player picks one option, NPC responds, END.
 */
export const SIMPLE_SCENARIO = `---
dialog:
  id: "test_simple"
  title: "Simple Test"
  participants: ["npc", "player"]

characters:
  npc:
    name: "Bot"
  player:
    name: "Tester"
---

VAR speaker = ""

=== start ===
~ speaker = "npc"
Hello! How are you?

+ [I am fine]
    -> fine_path

=== fine_path ===
~ speaker = "player"
I am fine, thanks!

~ speaker = "npc"
Great to hear. Goodbye!

-> END
`;

/**
 * BRANCHING_SCENARIO
 * 3 choices in start leading to 3 different endings.
 * Each ending has a unique final message for easy assertion.
 */
export const BRANCHING_SCENARIO = `---
dialog:
  id: "test_branching"
  title: "Branching Test"
  participants: ["npc", "player"]

characters:
  npc:
    name: "Guide"
  player:
    name: "Hero"
---

VAR speaker = ""

=== start ===
~ speaker = "npc"
Choose your path wisely.

+ [Path Alpha]
    -> path_alpha
+ [Path Beta]
    -> path_beta
+ [Path Gamma]
    -> path_gamma

=== path_alpha ===
~ speaker = "npc"
You chose Alpha. Ending A reached.

-> END

=== path_beta ===
~ speaker = "npc"
You chose Beta. Ending B reached.

-> END

=== path_gamma ===
~ speaker = "npc"
You chose Gamma. Ending C reached.

-> END
`;

/**
 * MULTI_STEP_SCENARIO
 * 3+ sequential knots for testing persistence.
 * Each step has exactly one choice to advance, making it deterministic.
 */
export const MULTI_STEP_SCENARIO = `---
dialog:
  id: "test_multistep"
  title: "Multi Step Test"
  participants: ["npc", "player"]

characters:
  npc:
    name: "Narrator"
  player:
    name: "Reader"
---

VAR speaker = ""

=== start ===
~ speaker = "npc"
Step one begins.

+ [Continue to step two]
    -> step_two

=== step_two ===
~ speaker = "npc"
Step two reached.

+ [Continue to step three]
    -> step_three

=== step_three ===
~ speaker = "npc"
Step three reached.

+ [Continue to the end]
    -> final

=== final ===
~ speaker = "npc"
All steps complete. The end.

-> END
`;
