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
+-------------------+
| Pattern Detection |  Scan last 4-5 AI messages
+-------------------+  for structural repetition
        |
   +---------+
   | Pattern | --YES--> Rephrase repeated messages
   | found?  |          (cheap API call, ~200 tokens)
   +---------+          Swap only in API context,
        |               user still sees originals
        NO
        |
        v
+------------------------+
| Build Context Messages |
+------------------------+
        |
        |   Assembles this array for the API:
        |
        |   +---------------------------+
        |   | 1. System prompt          |
        |   +---------------------------+
        |   | 2. Summary (if exists)    |
        |   |    "They met at the cafe, |
        |   |     discussed music..."   |
        |   +---------------------------+
        |   | 3. Last 4 messages        |
        |   |    (original or rephrased)|
        |   +---------------------------+
        |
        v
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

| Check                | Example trigger                         |
|----------------------|-----------------------------------------|
| Similar length       | All messages within ±20% character count|
| Same sentence count  | All have exactly 3 sentences            |
| Ending pattern       | All end with *italicized action*        |
| Ending with question | All end with "?"                        |
| Repeated openers     | All start with similar words            |

If 3+ checks match → pattern detected → messages get rephrased before
being sent to the API.

### Why This Works

The core problem: LLMs are autoregressive. If the context contains 10
messages with the same structure, the model copies that structure.
Telling it "don't repeat" in the prompt loses to 10 concrete examples.

This architecture attacks the root cause:
- **Short window** (4 messages instead of 10) — less material to copy
- **Rephrasing** — even those 4 messages look structurally different
- **Summary** — older messages compressed into plot, not style

## Security Notice

API keys are stored in localStorage unencrypted. Do not use this app on shared or public devices.

## License

MIT
