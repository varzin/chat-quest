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

The AI chat engine manages how conversation history is sent to the LLM.
Two systems work together to keep responses fresh and context-aware.

### Message Flow

```
User sends message
        |
        v
+------------------------+
| Build Context Messages |  Uses shadow copies from
+------------------------+  _rephrasedMap if available
        |
        |   Assembles this array for the API:
        |
        |   +---------------------------+
        |   | 1. System prompt          |
        |   +---------------------------+
        |   | 2. Summary (if exists)    |
        |   +---------------------------+
        |   | 3. Recent messages        |
        |   |    (shadow or original)   |
        |   +---------------------------+
        |
        v
+-------------------+
| Pattern Detection |  Scan last 4-5 AI messages
+-------------------+  for structural repetition
        |
   +---------+
   | Pattern | --YES--> 1. Rephrase in context
   | found?  |              (API call, ~200 tokens)
   +---------+          2. Save shadow copies
        |                   for future contexts
        NO              3. Inject anti-repetition
        |                   directive (system msg
        v                   before last user msg)
+------------------+
| API call → Reply |
+------------------+
        |
        v
+----------------------+
| Summarize if needed  |  Every ~20 new messages:
| (API call)           |  old summary + new msgs
+----------------------+  → 2-3 sentence plot summary
        |
        v
      Done
```

### Pattern Detection (heuristic, no API call)

Checks the last 4-5 AI messages for structural similarity:

| Check                | Signal name          | Example trigger                         |
|----------------------|----------------------|-----------------------------------------|
| Similar length       | `same_length`        | All messages within ±20% character count|
| Same sentence count  | `same_sentence_count`| All have exactly 3 sentences            |
| Ending pattern       | `all_end_with_action`| All end with *italicized action*        |
| Ending with question | `all_end_with_question`| All end with "?"                      |
| Repeated openers     | `same_opening`       | All start with similar words            |

If 3+ checks match → pattern detected → three countermeasures activate:

1. **Rephrasing** — assistant messages in context are rephrased via API
2. **Shadow copies** — rephrased texts stored in `_rephrasedMap`, reused
   in all future `_buildContextMessages` calls (user still sees originals)
3. **Anti-repetition directive** — a system message injected before the
   last user message, describing the specific detected patterns and
   instructing the model to vary structure (in conversation language)

### Why This Works

The core problem: LLMs are autoregressive. If the context contains 10
messages with the same structure, the model copies that structure.
Telling it "don't repeat" in the prompt loses to 10 concrete examples.

This architecture attacks the root cause at three levels:
- **Shadow copies** — the model never sees the original repetitive messages again
- **Directive** — explicit instruction naming the exact patterns to avoid
- **Summary** — older messages compressed into plot, not style

## Security Notice

API keys are stored in localStorage unencrypted. Do not use this app on shared or public devices.

## License

MIT
