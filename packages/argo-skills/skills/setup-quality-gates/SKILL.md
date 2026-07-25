---
name: setup-quality-gates
description: Turn the arithmetic half of the house rules into build failures — function length, cognitive complexity, parameter count, type escape hatches, dead code, and copy-paste duplication — by resolving each cap to a real rule in whatever linter the repo already runs (Biome, ESLint, oxlint, Ruff, golangci-lint), as an error, wired into a quality script, pre-commit and CI. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install this piece or re-tighten caps later.
disable-model-invocation: true
---

# Setup Quality Gates

Some house rules are judgment ("is this the right seam?"); the rest are arithmetic
("is this function 200 lines?"). Arithmetic belongs in a gate, not in review — an
agent that has to *remember* a cap will drift past it, and a reviewer who has to
count is being asked to do a machine's job.

This skill installs the arithmetic half. The prose half is the `setup-rules` skill;
the two must agree, and this config is the authority when they disagree.

**Every gate is an error, never a warning.** A warning is a violation with permission
to stay. If a cap can't be an error in this repo yet, it gets ratcheted (§5) — not
downgraded.

**Do not carry rule names in your head.** Linters rename, promote, and retire rules
between minor versions, and a config with one unknown rule name can fail closed or
silently do nothing. Every rule this skill writes is one you resolved against the
installed version in §3.

Templates ship inside this skill at `templates/`: `file-length-check.mjs` (the
fallback for the one cap most linters lack) and `quality-gates.yml` (the CI job).

## 1. Detect the toolchain

Read each off the repo:

- **The linter that already runs here** — a `biome.json`/`biome.jsonc`, an
  `eslint.config.*`/`.eslintrc*`, `.oxlintrc.json`, `ruff.toml` or `[tool.ruff]` in
  `pyproject.toml`, `.golangci.yml`, `phpstan.neon`. Whatever is here **wins**;
  never install a second linter alongside one that works. Multi-language repo → one
  gate set per language, each in that language's own linter.
- **Its installed version** — from the lockfile or `<linter> --version`. Rule
  availability is version-specific and §3 depends on it.
- **No linter at all** — install the one this ecosystem defaults to today (look it
  up; don't recall it), configure it minimally, then continue.
- **Package manager, test/lint scripts, pre-commit setup, CI workflows** — the wiring
  targets in §6.
- **Whether `setup-rules` has run** (a `rules/` folder at the root). If it has, the
  numbers you land here must match its prose; if not, note that the prose half is
  missing.

## 2. The intents to gate

Each row is an intent with a target number, not a rule name. The numbers are the
defaults — a repo may land looser ones (§5), never at the cost of dropping the gate.

| # | Intent | Target | Why it's mechanical |
|---|---|---|---|
| 1 | Function body length | 50 lines | Length is countable; "too long" isn't |
| 2 | Cognitive/cyclomatic complexity | 15 | The branch count nobody tracks by eye |
| 3 | Positional parameters | 3 max | The 4th argument is invisible at the call site |
| 4 | Nested ternaries | forbidden | Reads as one expression, branches like three |
| 5 | `any` (or the language's opt-out type) | forbidden | Disables checking downstream, not just here |
| 6 | Assertion escape hatches — `as`, non-null `!`, `@ts-ignore` | forbidden | A claim the compiler stops verifying |
| 7 | `else` after a returning branch | forbidden | The guard-clause rule, mechanized |
| 8 | Non-exhaustive switch over a union | error | The exhaustiveness the union was for |
| 9 | Unused exports, variables, imports | error | Dead code the reader still has to read |
| 10 | Duplicated blocks across files | threshold | Eyes don't diff files; §4 |
| 11 | File length | ~150 lines | The extract-before-you-dump trigger; §4 |

Intents 1–9 are ordinary lint rules in most ecosystems. 10 and 11 usually are not —
they get their own tools in §4.

## 3. Resolve each intent to a real rule — verify, don't recall

For each intent, find the rule in **this** linter at **this** version, and prove the
name exists before writing it. Use the tool as the source of truth:

| Linter | How to resolve and verify |
|---|---|
| Biome | `<pm> x @biomejs/biome explain <ruleName>` — prints the diagnostic category, default severity, and the version it landed in; an unknown name errors. Search candidates in its rule index first. |
| ESLint | Read the rule list from the installed plugin (`node_modules/<plugin>/`) or its docs, then verify by config: an unknown rule fails the run with "Definition for rule … was not found". |
| oxlint | `oxlint --rules` lists what this binary supports. |
| Ruff | `ruff rule <code>` explains a code; `ruff linter` lists families. |
| golangci-lint | `golangci-lint help linters` — the enabled/available set for this version. |

Rules for the resolution pass:

- **One intent may need several rules** (intent 6 is typically three separate rules)
  or **none** (a language with no `any` has no intent 5). Both are fine.
- **Set the number explicitly** even when it matches the tool's default — the default
  can change under you, and the config is where the house number is recorded.
- **Set severity to `error` explicitly.** Most of these ship as `warn` or `info`;
  that is the single most common reason a "configured" cap never fires.
- **A rule you cannot verify does not get written.** Log the intent as
  *prose-only* — it stays enforced by `rules/` and review, and the report says so.
- **A nursery/experimental rule** is worth taking if it's the only implementation, but
  name it as such in the report — it can be renamed on the next minor.

Then write the config, and prove the config itself loads: run the linter once and
confirm it neither errors on an unknown rule nor silently ignores the block. A
deliberate one-line violation (a 5-parameter function in a scratch file) that comes
back as an **error** is the check that the whole chain is live — delete it after.

## 4. The two intents that need their own tool

**Duplication (intent 10).** Copy-paste is invisible to a linter that reads one file
at a time. Install the ecosystem's copy-paste detector — for JS/TS that's `jscpd`
today; confirm the current name and flags before wiring it — and configure:

- A minimum clone size in tokens/lines, so a shared import block isn't a "clone".
- A **threshold** that exits non-zero when duplication crosses it, so it gates rather
  than reports.
- Ignores for generated output, lockfiles, snapshots, and vendored code.

**File length (intent 11).** Most linters cap function length, not file length. If
this linter has a per-file rule, use it. Otherwise copy
`templates/file-length-check.mjs` into the repo's scripts folder **verbatim** and run
it with the source globs and cap as arguments. Exempt what the house rule exempts:
generated files, pure-data modules, state machines, snapshots.

## 5. Land it on an existing codebase — ratchet, never loosen

A fresh repo passes immediately. A real one won't. Run every gate, count the
violations, and pick per gate:

- **Fix now** if the count is small and the fixes are mechanical. Preferred.
- **Ratchet** if it isn't: keep the cap at the house number and record the current
  violations as scoped, expiring exemptions — one entry per path glob per rule, each
  with a one-line reason. Every linter has a form of this (Biome `overrides`, ESLint
  flat-config blocks, jscpd `ignore`, a baseline file). New code meets the cap; the
  exemption list only ever shrinks.
- **Never** raise the global number to make the count zero, and never scatter inline
  suppressions — that converts a gate into decoration. If a cap is genuinely wrong for
  this repo, change it deliberately in the config *and* in the matching `rules/` prose,
  with the reason, in the same commit.

Report the starting violation count per gate. That number is the ratchet's baseline
and the only way anyone can tell later whether it's shrinking.

## 6. Wire it so it can't be skipped

1. **One script** in the manifest that runs every gate and fails on any:
   the linter, the duplication detector, and the file-length check. Name it `quality`
   unless the repo already has a convention. In a monorepo, add the aggregate at the
   root (turbo/nx) and the real script per workspace.
2. **Pre-commit** — if the repo has hooks (the `setup-pre-commit` skill installs
   them), append the gate to the existing hook rather than adding a second one, and
   keep it staged-files-only so committing stays fast.
3. **CI** — copy `templates/quality-gates.yml` into the workflows folder, swap the
   package-manager setup line and the workspace directory. CI is the backstop that a
   local `--no-verify` can't bypass.
4. **Tell the agents** — add a short **Quality gates** note to `AGENTS.md` (and
   `CLAUDE.md` if it isn't just importing `AGENTS.md`): the script name, what it gates,
   and that a new violation is fixed or ratcheted, never suppressed inline.

## 7. Report

Per gate: the intent, the rule name(s) actually resolved and their source, the number
landed, and the starting violation count. Then: which intents came back
**prose-only** and why, the script name, whether pre-commit and CI are wired, and the
path to the exemption list with its current size. Point the user at the one file to
edit when a cap needs to change — and remind them that the matching `rules/` prose
changes in the same commit.
