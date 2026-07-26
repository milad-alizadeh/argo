---
name: setup-quality-gates
description: Turn the arithmetic half of the house rules into build failures — function length, cognitive complexity, parameter count, type escape hatches, dead code, and copy-paste duplication — by resolving each cap to a real rule in whatever linter the repo already runs (Biome, ESLint, oxlint, Ruff, golangci-lint), as an error, wired into a quality script, pre-commit and CI. Usually dispatched by the /setup-argo-skills wizard; run directly to (re)install this piece or re-tighten caps later.
disable-model-invocation: true
---

# Setup Quality Gates

Install the arithmetic half of the house rules as build failures — the caps a reviewer
would otherwise count by hand. `setup-rules` owns the judgment half; where the two
disagree, this config is the authority.

Two rules bind every step:

- **Set every gate to `error`.** Most ship as `warn` or `info`, which is a violation with
  standing permission. A cap this repo can't meet yet gets ratcheted (§5), not downgraded.
- **Resolve rule names against the installed tool (§3), never from memory.** Linters
  rename, promote and retire rules between minor versions.

Templates ship at `templates/`: `file-length-check.mjs` and `quality-gates.yml`.

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

| # | Intent | Target |
|---|---|---|
| 1 | Function body length | 50 lines |
| 2 | Cognitive/cyclomatic complexity | 15 |
| 3 | Positional parameters | 3 max |
| 4 | Nested ternaries | forbidden |
| 5 | `any` (or the language's opt-out type) | forbidden |
| 6 | Assertion escape hatches — `as`, non-null `!`, `@ts-ignore` | forbidden |
| 7 | `else` after a returning branch | forbidden |
| 8 | Non-exhaustive switch over a union | error |
| 9 | Unused exports, variables, imports | error |
| 10 | Duplicated blocks across files | threshold |
| 11 | File length | ~150 lines |

Intents 1–9 are ordinary lint rules in most ecosystems. 10 and 11 usually are not —
they get their own tools in §4.

**Not every intent exists in every language, and a missing one is not a gap to fill.** A
language with no gradual-typing escape hatch has no intent 5; one whose compiler already
rejects unused variables has intent 9 for free; one with no ternary has no intent 4. Mark
those **n/a** in the report — distinct from *prose-only* (the intent applies here but this
toolchain can't check it). Inventing a rule to cover an intent the language doesn't have is
how a config ends up gating nothing.

The intents that travel unchanged everywhere are 1, 2, 3, 10, and 11 — length, complexity,
arity, duplication, file size are arithmetic, and arithmetic doesn't care about syntax.

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

Plant that violation in **the least likely directory the rules claim to govern** — a
`scripts/`, `tools/`, or `build/` folder, not next to the app code. A gate that fires in
`src/` and is silent in `scripts/` looks identical to a working gate from the report, and
§6.1 explains the usual cause.

## 4. The two intents that need their own tool

**Duplication (intent 10).** Copy-paste is invisible to a linter that reads one file
at a time. Install a copy-paste detector — `jscpd` is language-agnostic (it tokenizes
by format, so one install covers a polyglot repo) and some ecosystems ship their own
(`dupl` for Go, PMD-CPD for the JVM). Confirm the current name and flags before wiring
it, then configure:

- A minimum clone size in tokens/lines, so a shared import block isn't a "clone".
- A **threshold** that exits non-zero when duplication crosses it, so it gates rather
  than reports.
- Ignores for generated output, lockfiles, snapshots, and vendored code.

**File length (intent 11).** Most linters cap function length, not file length. If this
linter has a per-file rule, use it (ESLint's `max-lines`, Ruff's family). Otherwise copy
`templates/file-length-check.mjs` into the repo's scripts folder **verbatim** and run it
with the source globs and cap as arguments — it counts lines, so it works on any
language's files, and needs only a Node or Bun runtime available in CI. Exempt what the
house rule exempts: generated files, pure-data modules, state machines, snapshots.

Record exemptions with `--exempt-from <file>`, one glob per line with a `#` comment giving
the reason, and separate permanent **kind** exemptions from **ratchet** debt in that file
(§5). A bare `--exempt` list with no reasons decays into a permanent allowlist.

## 5. Land it on an existing codebase — ratchet, never loosen

A fresh repo passes immediately. A real one won't. Run every gate, count the
violations, and pick per gate:

- **Fix now** if the count is small and the fixes are mechanical. Preferred.
- **Ratchet** if it isn't: keep the cap at the house number and record today's violations
  as scoped exemptions — one entry per path glob per rule, each carrying a one-line reason
  and labelled **KIND** (the rule genuinely doesn't apply to this category; permanent) or
  **RATCHET** (real debt; the list may only shrink). Every linter has a form of this: Biome
  `overrides`, ESLint flat-config blocks, jscpd `ignore`, a baseline file.
- **Small but not mechanical** — a handful of violations that each need a real judgement
  call (a screen that wants splitting, a function whose complexity is the domain's) is
  neither branch. Ratchet it *and* list those files in the report as the first debt to pay,
  rather than making a design decision on the way past. Never leave them unlisted: an
  unlisted ratchet entry is indistinguishable from a permanent exemption.
- **Raising a global cap or scattering inline suppressions is out.** If a cap is wrong for
  this repo, change the config *and* the matching `rules/` prose in one commit, with the reason.

### Scope every exemption as narrowly as the tool allows

A path-only exemption silences the rule for the **whole file, forever** — including the
violation someone adds tomorrow. That defeats the ratchet: the list stops shrinking because
nothing forces it to. Where the tool can also match the message, symbol, or line
(`golangci-lint` `text:`, a baseline file keyed by finding, an ESLint block scoped to one
rule), use it — and where it can't, say so in the entry's reason.

Four ways an exemption comes out wider than intended. Each of these has shipped:

- **Unanchored patterns match as substrings.** A linter's exclude-path list is usually
  regexes, not globs: `vendor` also exempts `internal/vendorportal/`. Anchor every one
  (`^vendor/`, `/testdata/`), and a bare-basename glob (`*.gen.ts`) matches at every depth —
  say so deliberately or qualify the path.
- **Message-scoped is not instance-scoped.** A `text:` regex that matches the *rule's*
  wording ("cognitive complexity of func") exempts every future violation of that rule in
  that file, which is the path-only exemption with extra steps. Anchor on the symbol —
  the function or identifier the debt actually lives in.
- **An expression is not a symbol either.** Anchoring on the offending *source line*
  (`source: json\.NewEncoder\(w\)\.Encode\(`) reads like a pin to one place and is really a
  pin to one *shape*: the next function in that file that writes the same line inherits the
  exemption, brand new and silent. If the tool matches only source text, choose a fragment
  that includes the symbol's own declaration — or accept it as blanket and label it so.
- **A count-based baseline ratchets count, not magnitude.** Baseline files that record "this
  file had 3 findings" let an exempted file grow without limit: a 200-line function becomes
  800 and the count is still 3. That is a real ratchet for *new files* and no ratchet at all
  for the listed ones — so where the tool works this way, **say so in the exemption file and
  in the note you write in §6.4**. Otherwise the repo is told the list may only shrink, and
  that is false.
- **Category exclusions turn off more than the category.** "Skip files with a
  `Code generated … DO NOT EDIT` header" usually skips *every* rule, not just the line
  ceiling the house rule waives — and since the header is a line anyone can type, that is an
  unlabelled, self-service escape hatch outside the exemption files entirely. Name the rules
  a category exclusion turns off, and keep it to those.

  Where the tool offers a knob to turn that exclusion **off**, prove the knob **per rule,
  not in aggregate**. `golangci-lint`'s `exclusions.generated: disable` restores errcheck,
  funlen and dupl on a generated-header file while `revive` goes on skipping it under its own
  logic — so the parameter cap, the line ceiling and three more stay switchable by typing one
  comment, while the run reports enough other findings to look fixed. Two byte-identical
  files, one with the header and one without, is the check; whatever the header still
  suppresses is still an escape hatch.

**Then prove it, with a new and different violation.** Not a copy of the recorded one — a
*different* breach of the same rule, in an exempted file, and confirm the gate still fires.
A copy proves only that the tool matched the text you gave it. If the new one is silent, the
exemption is wider than the debt it was written for; narrow it, or record it honestly as the
blanket exemption it is.

### Reasons need somewhere to live

An exemption without its reason decays into a permanent allowlist. So the reason needs a
format that permits comments — prefer the `.jsonc` variant where the linter offers one, and
**verify it still lints after the edit**: Biome silently checks zero files when `biome.json`
contains a comment, rather than erroring.

Some tools have **no commentable format at all** — `jscpd`'s `.jscpd.json` is plain JSON,
and a comment there makes auto-discovery skip the entire config silently (no threshold, a
different file count) while an explicit `-c` hard-errors. For those: keep the config
comment-free, put the reasons in a sibling file that already holds them (the file-length
exemption list is the natural home), and **verify the config is loaded by its effect** —
compare the reported file count and confirm the threshold fires — never by the run's exit
code alone.

Report the starting violation count per gate — that number is the ratchet's baseline.

### Violations the install itself introduced

A base config you installed in §1 brings its own rules, and they can fail on day one — a
framework's shareable config flagging existing code the repo has always had. Those are yours
to resolve before finishing, on the same fix-or-ratchet terms as everything else. Finishing
with `quality` red teaches the whole team, and every agent, that the gate is advisory —
which is the one outcome this skill exists to prevent.

## 6. Wire it so it can't be skipped

1. **One script** in the manifest that runs every gate and fails on any:
   the linter, the duplication detector, and the file-length check. Name it `quality`
   unless the repo already has a convention. In a monorepo, add the aggregate at the
   root (turbo/nx) and the real script per workspace.

   **Call the linter directly, with an explicit path.** Frameworks ship lint wrappers —
   `expo lint`, `next lint`, and their kin — and a wrapper carries **its own hardcoded
   default inputs**, which are its idea of where source lives, not yours. Expo's, for one,
   is `['src', 'app', 'components']`: a 200-line four-parameter file in `scripts/` returns
   exit 0 from the wrapper and a wall of errors from the linter run directly. The gate looks
   configured, reports green, and governs a subset of what the rules claim.

   So: prefer `eslint .` over bare `expo lint`, and whatever the equivalent is elsewhere. If
   a wrapper must be kept (it supplies config the direct call can't reach), pass the paths
   explicitly and **verify coverage** — the §3 planted violation, in the directory furthest
   from the app source.

   **Then check coverage by enumeration, not by sampling.** Get the gate to list the files it
   actually read (most linters have a flag for this; failing that, count them) and diff that
   against the union of the `paths:` globs in `rules/`. One planted file proves a directory
   is reachable; only the diff finds the files nothing reaches. Three ways they hide, all
   observed, and none of them is a wrapper:

   - **Conditional compilation.** Files behind a build tag or platform constraint are invisible
     to a linter run without that tag — thousands of lines, silently, while the rules claim them.
   - **A nested module or workspace** below the root the gate is invoked from. The run stops at
     the boundary and exits 0.
   - **A default include list** in the linter's own config that predates you.

   The set of files the gate reads must equal what `rules/` claims to govern. Where it can't,
   narrow the rules' claim to match — an unreachable claim is worse than a smaller one,
   because an agent believes it.

   Finally: **run the wired command yourself, exactly as written, in a clean shell**, and
   record the exit code in the report. Not the underlying tool — the command. A gate that
   calls a linter installed into a user-global bin dies with exit 127 wherever that bin isn't
   on `PATH`, including CI, so pin such a tool into the repo and invoke it by path or through
   the package manager's runner. "The linter passes" and "the gate runs" are different claims,
   and only the second one is the gate.
2. **Pre-commit** — if the repo has hooks (the `setup-pre-commit` skill installs
   them), append the gate to the existing hook rather than adding a second one, and
   keep it staged-files-only so committing stays fast. A staged-files invocation runs from
   the repo root by default, which is where it stops seeing per-workspace baselines — §6a.

   No hooks here? Don't install a hook framework as a side effect of this skill — that's
   `setup-pre-commit`'s job and its own decision. Wire CI (step 3), which is the gate that
   actually can't be bypassed, and report that pre-commit is unwired and which skill wires it.
3. **CI** — copy `templates/quality-gates.yml` into the workflows folder, swap the
   package-manager setup line and the workspace directory, and **delete the
   `{{SWAP_FOR_YOUR_PM}}` marker comments once swapped** — a leftover marker in a landed
   workflow reads as unfinished install. If the repo already has a CI workflow that runs
   lint, add the gate steps there instead of adding a second workflow. CI is the backstop
   that a local `--no-verify` can't bypass.
4. **Tell the agents** — add a short **Quality gates** note to `AGENTS.md` (and `CLAUDE.md`
   if it isn't just importing `AGENTS.md`): the script name, what it gates, every file that
   holds exemptions, and that a new violation is fixed or ratcheted, never suppressed inline.
   Count the exemption files before you write that sentence — a duplication config's ignore
   list is one of them. Claim only what you verified: "dead code" is not gated by a rule that
   catches unused *variables* if unused **exports** go unchecked.

## 6a. Prove the gate in every context that runs it

§6.1 asks for the wired command's exit code from a clean shell. That is **one of three**
contexts, and a gate that passes in one and fails in another is worse than one that fails
everywhere — the disagreement is what teaches a team to bypass it. Run it in each — local
shell, the pre-commit hook, CI — and reconcile every difference before you finish. They must
resolve the same config, the same exemption files, and the same toolchain.

- **CI pins a toolchain from a file, and it may not be the one your command needs.** A Go
  workflow with `go-version-file: go.mod` gets whatever `go.mod` declares; wire a command
  using a flag introduced later (`go tool -modfile=…` needs 1.24+, `go.mod` said `go 1.23`)
  and every PR run dies with a usage error before one file is linted. No toolchain
  auto-switch rescues it — the CLI rejects the flag before it reads a module. Read the pin,
  read the minimum version of each flag you wired, and make them agree explicitly.
- **A hook running from the repo root does not load per-workspace state.** Piping staged
  paths to a root-level linter skips the baseline or suppression file sitting in each
  workspace, so the hook rejects exactly the recorded debt that `quality` and CI accept —
  every ratcheted file becomes uncommittable. Run the linter per workspace, or point it at
  the right state file.
- **A workspace with no config of its own falls through to the root config**, whose patterns
  anchor at the *root* — a block scoped `files: ["src/**/*.{ts,tsx}"]` matches nothing there,
  and that workspace silently loses whichever intents the block carried. So the §6.1
  enumeration runs per workspace, not once at the root.

**Enumerate on a built tree, not only a clean checkout.** Generated output doesn't exist when
you install and does exist in CI, because the build or codegen step runs *immediately before*
the gate. A linter pointed at `.` will read a framework's generated types and fail on them.
Build first, then run the gate, then ignore the generated trees by path. This is the one case
where §6.1's rule cuts the other way: here the gate reads files `rules/` never claimed.

**The exit code must reflect every rule you configured.** A shareable base config brings its
own severities, and a wired command with no `--max-warnings 0` (or its equivalent) fails on
none of them. Compute the effective severity of the whole ruleset — `eslint --print-config
<file>` and its kin print it — count how many resolve to `warn`, and either raise them or
pass the flag. Until then, "every rule is an error" is a claim about your config block and
not about the gate, and §6.4 must not write it.

## 6b. Reconcile the prose with the config — mandatory, not aspirational

The rules in `rules/` were written before this config existed, so some of them now describe a
world the gate contradicts. Re-read every installed rule against what you just landed and fix
the mismatches **in the same commit**. §1 already says the config wins where the two disagree
— this is the step where that gets applied rather than assumed.

The mismatch that matters most is a **prose-sanctioned escape the gate forbids**: a rule
saying "an assertion is allowed at a documented boundary" while the linter makes every
assertion an error with no legal spelling. That leaves an agent no conforming move — it must
break the rule or break the build, and whichever it picks it learns the rules are negotiable.
Either tighten the prose to match the gate, or configure the gate to permit the escape the
prose grants. Never ship both.

Two more to sweep for, both cheap:

- **An exemption the prose grants that the config doesn't implement** — "pure-data files are
  exempt from the line ceiling" is false unless the file-length tool actually exempts them.
- **A factual claim about this repo** that the install just invalidated: counts, file lists,
  "the linter will not catch X". Re-derive each one or delete it.

## 7. Report

Per gate: the intent, the rule name(s) actually resolved and their source, the number
landed, and the starting violation count. Then: which intents came back **n/a** (the
language has no such construct) versus **prose-only** (it applies but this toolchain can't
check it) and why, the script name, whether pre-commit and CI are wired, and the path to
the exemption list with its current size.

Four lines that are easy to omit and are the whole point of the run:

- **What the gate covers, proved.** Name the directory you planted the violation in and
  that it came back an error, plus the result of the enumeration diff (§6.1) — how many files
  the gate read against how many `rules/` claims. "Configured" is not the claim; "fires" is.
- **Does the wired command run — in all three contexts?** Its exact exit code from a clean
  shell, from the pre-commit hook, and on CI's pinned toolchain (§6a), plus how many of the
  configured rules resolve to `warn` and therefore can never fail it.
- **Is `quality` green right now?** If not, say what's red and why it was left that way.
- **Which exemptions are blanket rather than scoped**, and for any tool that ratchets by
  count, that magnitude in those files is ungated. This is the sentence a reader most needs
  and is least likely to derive on their own.

Point the user at the one file to edit when a cap needs to change — and remind them that
the matching `rules/` prose changes in the same commit.
