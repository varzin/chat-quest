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

## License

MIT
