---
name: scaffold-project
description: Generic project scaffolder. Runs a short wizard, then searches online for the ecosystem's official generator and language server, scaffolds a new project of any stack, and wires the LSP into whatever agent is running (Claude Code, Codex, Cursor, …). Use when starting a new project or repo from scratch.
---

# Scaffold Project

A small, generic scaffolder for any stack: run the wizard, look up the current tools online,
generate with the official CLIs, then prove it works. Don't hardcode ecosystems or hand-author
config a generator can produce.

**Golden rule: reach for a CLI, not your memory.** Every tool you add — the framework, *and* each
piece of tooling on top of it (formatter, linter, test runner, component library, Storybook, …) —
has its own official `create-*`/`init`/`add` command. Use it. Check that tool's own docs for the
current command before running it. Hand-authoring config is the last resort for what no generator
covers.

## 1. Wizard

Ask one question at a time, lead with a recommendation, skip anything you can already see:

1. **Target directory** — resolve to an absolute path and confirm. Must be empty or new. If it
   already holds a project, stop and say so (this skill is for new targets); never overwrite files.
2. **What are you building** — app / API / CLI / library / mobile / etc.
3. **Stack** — language + framework.
4. **Repo shape** — single repo or monorepo, decided by coupling (do the parts release together
   and share code?), not by counting folders.
5. **Package manager & baseline tooling** — formatter/linter/test config, `.gitignore`, `README`.

## 2. Search online for the current generators and LSP

Ecosystems change — web-search / read the official docs for:

- the **framework's official generator** and its current command (the `create-*` tool, or the
  language toolchain's `init`/`new`);
- **each additional tool's** own init/add command (e.g. `<linter> init`, `<component-lib> init`
  + `add`, `storybook init`, `create-<e2e>`) — read that tool's install page, don't guess flags;
- the stack's **language server** and how the current release installs it.

Prefer stable releases; note the versions you resolve. If the user says "use latest", verify the
true latest per package (`npm view <pkg> version`) rather than trusting remembered numbers — but let
a generator's own pinned versions stand when they're the vetted, working baseline.

## 3. Scaffold with the official generators

Run the framework generator into the confirmed target, then layer each additional tool with **its
own** CLI (not by hand). Along the way:

- **Drive interactive prompts non-interactively.** These generators prompt on a TTY. Prefer real
  flags (`--yes`, `--template`, `--browser`, `--package-manager`), and where a generator only
  prompts, drive it with `expect` feeding the answers. Some tools detect an AI-agent/non-TTY
  session and run unattended — let them.
- **Reconcile generator output to your layout.** A generator assumes a vanilla layout; a
  non-standard one (custom source dir, a wrapping build tool, a monorepo) will break its
  auto-detection. When a tool can't detect the framework, follow its documented *manual* steps
  instead: hand-write only the small pointer config it needs (e.g. the component-library
  `components.json`, path aliases, a `viteFinal`/equivalent to re-inject plugins its builder runs
  in isolation) and then use its `add` command, which works off that config.
- **Strip what the generator brought that the stack replaces** (e.g. remove eslint/prettier if you
  chose a single lint+format tool; drop a `postinstall` that fails on unrelated grounds).
- **Clean up package-manager leakage.** An `npx`/`create-*` tool may install with npm and drop a
  stray `package-lock.json` in a bun/pnpm workspace — remove it and reinstall with the chosen PM.

### Monorepo gotchas

- **Dedup shared build deps.** Under isolated installs (e.g. bun's default linker) the same tool
  (like `vite`) can resolve to several physical copies with incompatible *types*, breaking
  typecheck on config files. A hoisted/flat linker gives one copy; prefer it, and it's friendlier
  to native modules too.
- **Wire every tool's scripts to the monorepo runner** (turbo/nx/…) and add root passthrough
  scripts, so "runnable from the repo root" holds literally for lint, typecheck, unit, component,
  and e2e tests — not just the ones the framework generator wired.
- **Native modules** (PTYs, sqlite bindings, …) often need an ABI rebuild for the runtime
  (e.g. Electron). If unused in the first cut, note it's installed-but-not-rebuilt and defer.

## 4. Wire the LSP into the current agent

Detect which agent/editor is running this skill (Claude Code, Codex, Cursor, …) and set up the
language server the way **that** agent consumes LSPs — look up the mechanism if unsure:

- prefer an LSP the agent already bundles or can enable natively;
- otherwise install the server (project-local where possible) and register it per the agent's docs.

Ask before any machine-global install. Scaffolding must succeed even if the LSP step is skipped.

## 5. Validate and report

Run the stack's native commands and report actual results — cover **every** surface you wired, not
just the framework's: install, typecheck, lint, unit tests, component/story tests, e2e/app-launch
smoke, build, and a minimal start or import. Interactive generators leave subtle breakage
(ESM `__dirname`, an optimizer that reloads mid-test, a dead theme variant) that only a real run
surfaces. Then `git init` + first commit only if the user opts in (state that it changes history).
Summarize the target path, repo shape, generators used, LSP status, and the next command to run.
