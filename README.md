# Chat Quest

A prototype for testing interactive narrative game mechanics, inspired by text-based games like **Lifeline** (2015).

## Overview

Chat Quest is a messenger-style quest player that runs entirely in the browser. It presents interactive stories as chat conversations, where players make choices to advance the narrative.

Made with Claude Code.

## Getting Started

No build step required. Simply serve the files with any static server:

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser.

## Scenario Format

Scenarios use YAML front matter + Ink syntax. See `docs/format-spec.md` for details.

## Testing

```bash
node --test tests/*.test.mjs
```

## AI Context Architecture

The AI chat engine prevents style contamination through per-message
condensation. Each AI response is condensed to its essential content
after generation. The model sees clean factual context, not its own
previous stylistic patterns.

### Message Flow

```
User sends message
        |
        v
+------------------------+
| Build Context Messages |
+------------------------+
        |
        |   +-------------------------------+
        |   | 1. System prompt              |
        |   +-------------------------------+
        |   | 2. Summary (if exists)        |  ← very old messages
        |   +-------------------------------+
        |   | 3. Condensed context          |  ← older messages as
        |   |    Player: said X             |     system-role, facts
        |   |    Alice: did Y, said Z       |     only, no style
        |   +-------------------------------+
        |   | 4. Last 4 messages            |  ← originals as
        |   |    (user/assistant roles)     |     user/assistant
        |   +-------------------------------+
        |   | 5. Template Director          |  ← archetype directive
        |   |    (if enabled)               |     e.g. "SHORT_REACTION:
        |   |                               |     1 sentence, no question"
        |   +-------------------------------+
        |
        v
+------------------+
| API call → Reply |  frequency_penalty: 0.45
+------------------+  presence_penalty:  0.35
        |
        v
+------------------+
| Condense reply   |  Cheap API call (~200 tokens)
+------------------+  Extract: what happened,
        |              what was said, decisions.
        |              Third person, no style.
        v
  Store condensed version alongside original
  (user sees original, API sees condensed)
        |
        v
+----------------------+
| Summarize if needed  |  Every ~30 new messages
+----------------------+
        |
        v
      Done
```

### Why This Works

The core problem: LLMs copy style from their own previous messages
in the context (context poisoning). Telling the model "don't repeat"
loses to 10 concrete examples of the same pattern.

Per-message condensation attacks the root cause:
- **No style to copy** — older messages are bare facts, not prose
- **Concrete context** — condensed messages preserve what happened
- **System role** — model treats condensed history as reference, not as
  examples to emulate
- **Original window** — last 4 messages keep tone continuity
- **API penalties** — complementary token-level diversity pressure
- **Template Director** — selects response archetype (SHORT_REACTION,
  STORY, INITIATIVE, OBSERVATION, OPINION, TEASE) based on conversation
  state. Model executes the archetype instead of deciding structure itself.
  Toggleable via UI.

## Security Notice

API keys are stored in localStorage unencrypted. Do not use this app on shared or public devices.

## License

MIT
