---
name: setup-output-style
description: Install Argo's Terse output style into a project — copies the style template into .claude/output-styles/ and sets it as the Claude Code session default in .claude/settings.json. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install just this piece.
disable-model-invocation: true
---

# Setup Output Style

Install the **Terse** output style — answer-first ordering, hard caps on prose,
zero filler — so every Claude Code session in the project defaults to concise
output. The template ships **inside this skill** at `output-styles/terse.md`
(colocated next to this `SKILL.md`), so it works in any project the skill is
installed into, with no dependency on the argo monorepo.

This is a Claude Code feature; other agents (Codex, Cursor) ignore
`.claude/output-styles/` — their conciseness comes from AGENTS.md instructions.

## 1. Copy the style

Copy `<this-skill-dir>/output-styles/terse.md` to `.claude/output-styles/terse.md`
at the project root (create the directory). Copy verbatim — the style is
project-agnostic by design; project-specific instructions belong in
CLAUDE.md/AGENTS.md, never in the style file.

## 2. Set it as the default

Merge `"outputStyle": "Terse"` into `.claude/settings.json`, preserving existing
keys (create the file if absent). Use `.claude/settings.local.json` instead only
if the user wants it personal rather than repo-wide.

## 3. Report

Tell the user: the style takes effect on the next session or `/clear`, not
mid-session, and they can switch back any time via `/config` → Output style →
Default.
