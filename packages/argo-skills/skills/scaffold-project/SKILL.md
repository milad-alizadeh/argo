---
name: scaffold-project
description: Scaffold a new project of any stack from its ecosystem's own generators, with the language server wired into the running agent. Use when starting a repo from scratch or setting up an empty directory.
---

# Scaffold Project

**Golden rule: reach for a CLI, not your memory.** Every tool you add, the framework and each
piece of tooling on top of it, has its own official `create-*`/`init`/`add` command. Read
that tool's current docs, then use it. Hand-authoring config is the last resort for what no
generator covers.

## 1. Wizard

Ask one question at a time, lead with a recommendation, skip anything you can already see:

1. **Target directory**: an absolute path, empty or new. If it already holds a project, stop
   and say so.
2. **What are you building**: app / API / CLI / library / mobile.
3. **Stack**: language plus framework.
4. **Repo shape**: single repo or monorepo, decided by coupling (do the parts release
   together and share code?), not by counting folders.
5. **Package manager and baseline tooling**: formatter, linter, test config, `.gitignore`,
   README.

Done when the user has confirmed all five.

## 2. Resolve the generators and the language server

Search the official docs for the framework's generator, each additional tool's own init or
add command, and the stack's language server and how its current release installs. Prefer
stable releases; a generator's own pins stand as the vetted baseline.

Done when every generator, tool and language server has a command and a version written
down.

## 3. Scaffold with the official generators

Run the framework generator into the confirmed target, then layer each tool with its own
CLI.

- **Drive prompts non-interactively.** Prefer real flags (`--yes`, `--template`,
  `--package-manager`); where a generator only prompts, drive it with `expect`. Some tools
  detect a non-TTY session and run unattended.
- **When a tool cannot detect the framework** (a custom source dir, a wrapping build tool, a
  monorepo), follow its documented manual steps for the pointer config it needs, then use
  its `add` command.
- **Strip what the generator brought that the stack replaces**, such as a second linter or a
  `postinstall` that fails on unrelated grounds.
- **Remove package-manager leakage.** A `create-*` tool may install with npm and drop a
  stray lockfile into a bun or pnpm workspace; remove it and reinstall with the chosen one.
- **In a monorepo**, prefer a hoisted linker so a shared build tool resolves to one copy,
  and wire every tool's scripts to the monorepo runner with root passthrough scripts, so
  lint, typecheck, unit, component and e2e tests all run from the repo root.

Done when every chosen tool was installed by its own CLI, or its manual step is named with
the reason.

## 4. Wire the language server into the current agent

Detect which agent is running this skill and register the language server the way that
agent consumes one: prefer one it bundles or can enable natively, otherwise install it
project-local and register it per the agent's docs. Ask before any machine-global install.

Done when the server is registered for the running agent, or the user declined and the
report says so.

## 5. Validate and report

Run the stack's native commands and report actual results for every surface you wired:
install, typecheck, lint, unit tests, component tests, e2e or app-launch smoke, build, and a
minimal start. Then `git init` plus a first commit only if the user opts in. Summarise the
target path, repo shape, generators used, language-server status, and the next command to
run.
