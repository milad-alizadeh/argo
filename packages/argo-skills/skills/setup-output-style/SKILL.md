---
name: setup-output-style
description: Install Argo's Terse output style into a project — copies the style template into .claude/output-styles/ and sets it as the Claude Code session default in .claude/settings.json. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install just this piece.
disable-model-invocation: true
---

# Setup Output Style

Install the **Terse** output style — answer-first ordering, hard caps on prose,
zero filler — so every Claude Code session in the project defaults to concise
output.

This is a Claude Code feature; other agents (Codex, Cursor) ignore
`.claude/output-styles/` — their conciseness comes from AGENTS.md instructions.

## 1. Copy the style

Copy `<this-skill-dir>/output-styles/terse.md` (colocated next to this `SKILL.md`)
to `.claude/output-styles/terse.md` at the project root (create the directory).
Copy verbatim — project-specific instructions belong in CLAUDE.md/AGENTS.md, not
the style file.

## 2. Set it as the default

Merge `"outputStyle": "Terse"` into `.claude/settings.json`, preserving existing
keys (create the file if absent). Use `.claude/settings.local.json` instead only
if the user wants it personal rather than repo-wide.

## 3. Report

Tell the user: the style takes effect on the next session or `/clear`, not
mid-session, and they can switch back any time via `/config` → Output style →
Default.
