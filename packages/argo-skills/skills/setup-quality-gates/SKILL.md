---
name: setup-quality-gates
description: Turn the house rules' mechanical intents (length, complexity, arity, escape hatches, duplication, dead exports, import boundaries, test hygiene) into error-level gates in the repo's own linter, wired to a script, pre-commit and CI, plus the one-page prose residue no linter can check.
disable-model-invocation: true
---

# Setup Quality Gates

Install the caps a reviewer would otherwise count by hand as build failures, then write the
one page of prose that is left. Two rules bind every step:

- **Every gate is `error`.** A `warn` is a violation with standing permission. A cap the repo
  can't meet yet is ratcheted (§5), never downgraded.
- **Resolve rule names against the installed tool, never from memory.** Linters rename,
  promote and retire rules between minor versions.

## 1. Detect the toolchain

Write down, with a value or "none": the linter that already runs here and its config file
(`biome.jsonc`, `eslint.config.*`, `.oxlintrc.json`, `ruff.toml`, `.golangci.yml`,
`phpstan.neon`; whatever is here wins, one gate set per language in a polyglot repo); its
installed version; the package manager and lint/test scripts; the pre-commit setup; the CI
workflows; whether `rules/` exists. No linter at all: install the ecosystem's current default,
configured minimally, then continue. A previous unfinished run of this skill (staged configs,
a half-written baseline) is yours to verify and finish, never to layer a second install beside.

## 2. The intents to gate

Each row is an intent with a target, not a rule name.

| # | Intent | Target |
|---|---|---|
| 1 | Function body length | 50 lines |
| 2 | Cognitive/cyclomatic complexity | 15 |
| 3 | Positional parameters | 3 max |
| 4 | Nested ternaries | forbidden |
| 5 | `any` (or the language's opt-out type) | forbidden |
| 6 | Assertion escape hatches (`as`, non-null `!`, `@ts-ignore`) | forbidden |
| 7 | `else` after a returning branch | forbidden |
| 8 | Non-exhaustive switch over a union | error |
| 9 | Unused variables and imports | error |
| 10 | Duplicated blocks across files | threshold |
| 11 | File length | ~150 lines |
| 12 | Unused **exports**, a module's dead public surface | error |
| 13 | Imports that bypass a module's public entry or cross a layer | error |
| 14 | Circular dependencies between modules | error |
| 15 | Focused or skipped tests, committed | error |
| 16 | A file loose at a module root, a kind-folder, an unearned shared symbol | error |

Intents 1–9 are ordinary lint rules; 10–15 get their own tools (§4); 16 belongs to
`setup-module-boundaries`, whose scripts you wire into `quality` without reimplementing them.
**9 and 12 are two intents**: an unused-variable rule reads one file and sees an unimported
export as used, so "dead code is gated" is false until 12 has a tool. **A missing intent is
not a gap to fill**: a language with no gradual-typing escape has no intent 5, one whose
compiler rejects unused variables has 9 for free. Mark those **n/a**, distinct from
**prose-only** (applies here, this toolchain can't check it).

## 3. Resolve each intent to a real rule, and prove it fires

| Linter | Resolve and verify |
|---|---|
| Biome | `<pm> x @biomejs/biome explain <ruleName>`; an unknown name errors |
| ESLint | the installed plugin's rule list; an unknown rule fails the run |
| oxlint | `oxlint --rules` |
| Ruff | `ruff rule <code>`, `ruff linter` |
| golangci-lint | `golangci-lint help linters` lists linters, not the rules inside them |

- One intent may need several rules (6 is usually three) or none. Set the number and the
  `error` severity explicitly even where they match the default.
- A rule you cannot verify is not written; log the intent as prose-only.
- A nursery or experimental rule is worth taking if it is the only implementation; name it
  as such in the report.
- **A rule inside an aggregate runner's plugin cannot be verified by name.** An unknown
  sub-rule name is dropped silently, so the only proof is behavioural: plant a violation of
  that rule in a probe that violates nothing else (runners dedupe by line) and require its own
  name in the output. No firing, no row.

Then write the config and prove the chain is live: a deliberate violation in **the least
likely directory the rules claim to govern** (`scripts/`, `tools/`, not beside the app code)
comes back as an error, and is deleted after.

Done when every intent has a verified rule name, or an n/a or prose-only verdict in the report.

## 4. The intents that need their own tool

- **Duplication (10).** A copy-paste detector (`jscpd` is language-agnostic; `dupl` for Go,
  PMD-CPD on the JVM) with a minimum clone size, a threshold that exits non-zero, and ignores
  for generated output, lockfiles, snapshots and vendored code.
- **File length (11).** The linter's per-file rule where one exists; note what it counts, since
  a comment-skipping cap is looser than a raw count. Otherwise copy
  `templates/file-length-check.mjs` verbatim (Node 22+ or Bun) and run it with the source
  globs and cap; record exemptions with `--exempt-from <file>`, one glob per line with a
  reason, kind exemptions separate from ratchet debt.
- **Dead public surface (12).** A whole-graph pass: `knip` for JS/TS, `deadcode` for Go,
  `vulture` for Python; Rust's compiler already reports it, so n/a. Ratchet the first run.
  knip's per-file ignore leaves that file unguarded for every future dead export, its
  configuration hints will suggest deleting deliberate prospective ignores, and its `project`
  globs are an enumerated scope: label each of those where it lives.
- **The import graph (13, 14).** `dependency-cruiser` for JS/TS, `import-linter` for Python,
  `go-arch-lint` or `depguard` for Go, ArchUnit on the JVM. Go's compiler rejects cycles, so 14
  is n/a there. On TypeScript set `tsPreCompilationDeps: true`, since compilation erases
  `import type` and a deep type-only import otherwise exits 0; prove it with a planted
  type-only deep import. The module → public-entry map is data the config compiles, owned by
  `setup-module-boundaries`; a module missing from the map is added to the map, never fixed by
  loosening a pattern. Land 13 as a ratchet on any existing repo.
- **Placement (16).** `setup-module-boundaries` §5 owns it; wire its three scripts into
  `quality` and count their first-run breaches like any other ratchet.
- **Test hygiene (15).** `no-focused-tests` / `no-disabled-tests` from the test plugin
  (`eslint-plugin-vitest`, `eslint-plugin-jest`, or the ecosystem's equivalent); n/a where the
  ecosystem has no focus mechanism.

## 5. Land it on an existing codebase: ratchet, never loosen

Run every gate and count the violations. Per gate: **fix now** when the count is small and
mechanical; otherwise **ratchet**, keeping the cap at the house number and recording today's
violations as scoped exemptions, one entry per path glob per rule, each with a one-line reason
and labelled **KIND** (the rule genuinely doesn't apply; permanent) or **RATCHET** (debt; the
list may only shrink). A handful of violations that each need a real judgement call is
ratcheted and listed in the report as the first debt to pay. A cap that is wrong for this repo
changes in the config, with the reason, never inline and never as a global raise.

Read `references/exemptions.md` before writing the first entry: an exemption is proved with a
new and different violation, and the reasons have a home even where the config format forbids
comments. Violations a base config you installed brings on day one are yours to resolve on the
same terms; finishing with `quality` red teaches everyone the gate is advisory.

Done when each gate has a starting count and a fixed or ratcheted verdict, and every ratchet
entry carries KIND or RATCHET plus a reason.

## 6. Wire it so it can't be skipped

1. **One script** in the manifest, `quality` unless the repo has a convention, running every
   gate and failing on any; in a monorepo the aggregate at the root and the real script per
   workspace.
2. **Pre-commit.** Append to the existing hook, staged-files-only unless the inherited hook is
   already whole-repo; a hook red for a reason unrelated to your gates is fixed in its own
   commit when mechanical, otherwise reported as a blocker. No hooks here: wire CI and say
   pre-commit is unwired, without installing a hook framework as a side effect.
3. **CI.** Copy `templates/quality-gates.yml`, swap the package-manager line, delete the
   `{{SWAP_FOR_YOUR_PM}}` markers; or add the steps to an existing lint workflow.
4. **Prove it in all three contexts** and reconcile every difference: `references/three-contexts.md`.

Done when the wired command's exit code is recorded from a clean shell, the hook and CI (or
its emulation), and the three agree.

## 7. Write the prose residue and tell the agents

Copy `templates/house.md` to `rules/house.md`, resolving its placeholders: `{{LINT_CONFIG}}`
(the config file(s) you landed), `{{EXHAUSTIVE_CONSTRUCT}}` (this language's, and how a missed
case fails), `{{BOUNDARY_PARSER}}` (the ecosystem's parse-don't-declare tool),
`{{PUBLIC_ENTRY}}` (a barrel, `__init__.py`, `mod.rs`, exported identifiers), and
`{{DOC_SURFACES}}`: one sentence stating **whether** anything renders comments to a reader who
never opens the file (a docs build, or publishing that renders by default such as `pkg.go.dev`
or `docs.rs`), never empty, since a `public` marker and an IDE hover are not that reader. Where
a docblock is code (Python `__doc__`) or a linter requires it (`revive` `exported`,
`missing_docs`), say so there too. Every sentence in the template has to pass one test before
it stays: does it change what a strong model does by default? Cut any that doesn't, and add
nothing a linter could check.

Then add a **Rules and gates** section to the project doc that exists (`AGENTS.md`; `CLAUDE.md`
too only if it does not merely import `AGENTS.md`; never create a stub for the other): the
script name, what it gates, every file holding exemptions (a duplication config's ignore list
is one), that a new violation is fixed or ratcheted and never suppressed inline, and a pointer
at `rules/house.md`. Claim only what fired: "dead code" only if intent 12 has a tool, "every
rule an error" only after the warn count is zero. Grep the installed prose for `{{` and ship
zero hits. Where the doc already carries a Rules section, replace it in place.

## 8. Report

Per gate: intent, resolved rule name(s) and source, number landed, starting count, fixed or
ratcheted. Then: the n/a and prose-only intents with why; the script name; pre-commit and CI
wired or not; the exemption files and their sizes; the directory the planted violation fired
in and the enumeration diff (files read against files `rules/` claims); the three exit codes;
how many configured rules resolve to `warn`; which gates are pinned to a path list; whether
the tool's version is verified; whether `quality` is green now and what is red if not; and the
one file to edit when a cap needs to change.
