---
name: setup-output-style
description: Install Argo's Out Loud output style as the Claude Code session default.
disable-model-invocation: true
---

# Setup Output Style

Install the **Out Loud** output style, so every Claude Code session in the project
defaults to prose a reader can follow at speed.

This is a Claude Code feature; other agents (Codex, Cursor) ignore
`.claude/output-styles/` — their conciseness comes from AGENTS.md instructions.

1. Copy `<this-skill-dir>/output-styles/out-loud.md` to
   `.claude/output-styles/out-loud.md` at the project root, verbatim. Create the
   directory if absent. Project-specific instructions belong in CLAUDE.md/AGENTS.md,
   never in the style file.
2. Merge `"outputStyle": "Out Loud"` into `.claude/settings.json`, preserving
   existing keys. Use `.claude/settings.local.json` instead if the user wants it
   personal rather than repo-wide.
3. Tell the user it takes effect on the next session or `/clear`, and that
   `/config` → Output style switches back.
