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

## AI Anti-Repetition Architecture

The AI chat engine uses a 4-layer defense against formulaic responses.
No extra API calls — all countermeasures work locally except the main request.

### Message Flow

```
User sends message
        |
        v
+------------------------+
| Build Context Messages |  Token-budget window
+------------------------+  from displayedMessages
        |
        |   +-------------------------------+
        |   | 1. Preamble + System prompt   |  ← primacy bias
        |   +-------------------------------+
        |   | 2. Summary (if exists)        |
        |   +-------------------------------+
        |   | 3. Recent messages            |
        |   +-------------------------------+
        |
        v
+------------------------+
| Semantic Deduplication |  Compare AI msgs by
+------------------------+  n-gram overlap + structure
        |                    Remove similar, keep latest
        v
+------------------------+
| Variation State        |  JSON block listing
| Injection              |  detected patterns:
+------------------------+  openers, endings, lengths
        |                    Injected before last
        v                    user message
+------------------+
| API call → Reply |  frequency_penalty: 0.45
+------------------+  presence_penalty:  0.35
        |
        v
+----------------------+
| Summarize if needed  |  Every ~20 new messages
+----------------------+
        |
        v
      Done
```

### The 4 Layers

| Layer | Type | When | Cost |
|-------|------|------|------|
| **1. API penalties** | `frequency_penalty: 0.45`, `presence_penalty: 0.35` | Always | Zero — API parameter |
| **2. Semantic dedup** | N-gram Jaccard + structural similarity → remove duplicates from context | Always (≥3 AI msgs) | Zero — local heuristic |
| **3. Variation state** | System message listing detected patterns (openers, endings, lengths) | When patterns found | Zero — local analysis |
| **4. Primacy bias** | Anti-repetition preamble prepended to system prompt | Always | Zero — string concat |

### Similarity Detection

Each pair of AI messages is compared using a composite score:

| Factor | Weight | Description |
|--------|--------|-------------|
| N-gram overlap | 2x | Bigram Jaccard similarity |
| Length match | 1x | Within ±25% character count |
| Sentence count | 1x | Same number of sentences |
| Ending pattern | 1x each | Both end with *action* or "?" |
| Opening word | 1x | Same first word |

If composite score ≥ 0.4 → earlier message removed from context (with its
preceding user message, to keep pairing clean).

### Why This Works

The core problem: LLMs are autoregressive. If the context contains
messages with the same structure, the model copies that structure.

This architecture attacks the root cause at every level:
- **Deduplication** — repetitive messages are removed, not just rephrased
- **Variation state** — explicit tracking of what patterns to avoid
- **Primacy bias** — anti-repetition instruction at the top of context (models attend most to first/last 10%)
- **API penalties** — token-level diversity pressure
- **Summary** — older messages compressed into plot, not style

## Security Notice

API keys are stored in localStorage unencrypted. Do not use this app on shared or public devices.

## License

MIT
