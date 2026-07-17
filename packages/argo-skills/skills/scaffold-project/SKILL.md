---
name: scaffold-project
description: Generic project scaffolder. Runs a short wizard, then searches online for the ecosystem's official generator and language server, scaffolds a new project of any stack, and wires the LSP into whatever agent is running (Claude Code, Codex, Cursor, …). Use when starting a new project or repo from scratch.
---

# Scaffold Project

A small, generic scaffolder for any stack. Don't hardcode ecosystems and don't hand-author config
the official generator can produce — run the wizard, look up the current tools online, generate,
then prove it works.

## 1. Wizard

Ask one question at a time, lead with a recommendation, skip anything you can already see:

1. **Target directory** — resolve to an absolute path and confirm. Must be empty or new. If it
   already holds a project, stop and say so (this skill is for new targets); never overwrite files.
2. **What are you building** — app / API / CLI / library / mobile / etc.
3. **Stack** — language + framework.
4. **Repo shape** — single repo or monorepo, decided by coupling (do the parts release together
   and share code?), not by counting folders.
5. **Package manager & baseline tooling** — formatter/linter/test config, `.gitignore`, `README`.

## 2. Search online for the current generator and LSP

Ecosystems change, so don't rely on memory — do a quick web search / check official docs for the
chosen stack:

- the **official scaffolding generator** and its current command (e.g. the framework's `create-*`
  tool, or the language toolchain's `init`/`new`).
- the stack's **language server** and how the current release installs it.

Prefer stable releases; note versions.

## 3. Scaffold with the official generator

Run the official generator into the confirmed target. Make only the smallest edits needed to match
the wizard answers. Hand-authoring is a last resort for what no generator covers.

## 4. Wire the LSP into the current agent

Detect which agent/editor is running this skill (Claude Code, Codex, Cursor, …) and set up the
language server the way **that** agent consumes LSPs — look up the mechanism if unsure:

- prefer an LSP the agent already bundles or can enable natively;
- otherwise install the server (project-local where possible) and register it per the agent's docs.

Ask before any machine-global install. Scaffolding must succeed even if the LSP step is skipped.

## 5. Validate and report

Run the stack's native commands and report actual results: install, typecheck, lint, test, build,
and a minimal start or import. Then `git init` + first commit only if the user opts in (state that
it changes history). Summarize the target path, repo shape, generator used, LSP status, and the
next command to run.
