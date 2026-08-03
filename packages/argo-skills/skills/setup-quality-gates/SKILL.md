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
| 9 | Unused variables and imports | error |
| 10 | Duplicated blocks across files | threshold |
| 11 | File length | ~150 lines |
| 12 | Unused **exports** — a module's dead public surface | error |
| 13 | Imports that bypass a module's public entry, or cross a layer boundary | error |
| 14 | Circular dependencies between modules | error |
| 15 | Focused or skipped tests, committed | error |

Intents 1–9 are ordinary lint rules in most ecosystems. 10–14 usually are not — they get
their own tools in §4. 15 is an ordinary rule but lives in a test plugin most repos haven't
installed.

**9 and 12 are two intents, not one, and conflating them is the most common overclaim in
this skill's history.** A linter's unused-variable rule reads one file: an exported symbol
that nothing in the repo imports is *used* as far as it can tell. "Dead code is gated" is
false until 12 has its own tool, so either wire one or write the narrower sentence in §6.4.
The same split applies to 13 and 14: a per-file linter cannot see the import graph, which is
why `file-structure.md`'s central rule — the public entry — stays prose in most installs.
That is the largest block of house rules this skill can still mechanize.

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
- **A rule that belongs to a nested plugin can't be verified by the table above, and a
  wrong name there is silent.** Aggregate runners list *linters*, not the rules inside
  them: `golangci-lint help linters` names `revive` and never `revive`'s own
  `file-length-limit` or `argument-limit`. Worse, an unknown sub-rule name does **not** fail
  `config verify` and does not error at runtime — it is quietly dropped, so the intent reads
  as configured and gates nothing. For any rule one level down, verification by name is
  unavailable and the only proof is behavioural: plant a violation of that specific rule and
  require its own name in the output. No firing, no row.
- **A co-located finding can mask the one you planted.** Runners dedupe by line
  (golangci-lint's `uniq-by-line` is on by default), so a probe function that also
  trips a second rule on its declaration line reports only one of them — and the
  require-its-own-name proof above "fails" against a rule that works. Before concluding
  a rule is dropped, plant it in a probe that violates nothing else, or turn the dedup
  off for the proof run.

Then write the config, and prove the config itself loads: run the linter once and
confirm it neither errors on an unknown rule nor silently ignores the block. A
deliberate one-line violation (a 5-parameter function in a scratch file) that comes
back as an **error** is the check that the whole chain is live — delete it after.

Plant that violation in **the least likely directory the rules claim to govern** — a
`scripts/`, `tools/`, or `build/` folder, not next to the app code. A gate that fires in
`src/` and is silent in `scripts/` looks identical to a working gate from the report, and
§6.1 explains the usual cause.

Every exit code this skill asks you to record must come **from the gate command itself**,
not from anything wrapped around it: piping through `head` or `tee` reports the pipe's
status, and a backgrounded command's wrapper can report 0 while the tool inside failed.
Capture the code at the command (`cmd; echo $?`, or `pipefail` where a pipe is
unavoidable) — a proof built on a wrapper's exit code proves the wrapper.

## 4. The intents that need their own tool

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
linter has a per-file rule, use it (ESLint's `max-lines`, Biome's
`style/noExcessiveLinesPerFile` from 2.3.12, Ruff's family) — and note what it counts, because
they differ: Biome's skips comment lines entirely, so its cap is looser than a raw line count on
a heavily-commented codebase. Otherwise copy
`templates/file-length-check.mjs` into the repo's scripts folder **verbatim** and run it
with the source globs and cap as arguments — it counts lines, so it works on any
language's files, and needs only a Node or Bun runtime available in CI. Exempt what the
house rule exempts: generated files, pure-data modules, state machines, snapshots.

Record exemptions with `--exempt-from <file>`, one glob per line with a `#` comment giving
the reason, and separate permanent **kind** exemptions from **ratchet** debt in that file
(§5). A bare `--exempt` list with no reasons decays into a permanent allowlist.

**Dead public surface (intent 12).** Intent 9's rule stops at the file. Finding an export
nothing imports needs a whole-graph pass: `knip` for JS/TS, `deadcode` (`golang.org/x/tools`)
for Go, `vulture` for Python. Rust's compiler already reports it — mark 12 **n/a** there
rather than installing anything. Wire it into `quality` like any other gate, and expect a
large first run on an existing repo: ratchet it (§5) rather than deleting a hundred exports
on the way past. Two knip specifics: its narrowest baseline is a **per-file ignore** — a
file in the list is unguarded for every future dead export it grows, so state that
consequence in a comment on the ignore entry itself, the way §5 says it for count-based
ratchets — a warning that lives only in the agent docs is invisible to the next agent
editing the config. And knip prints *configuration
hints* suggesting you delete ignores it thinks are unused — including the deliberately
prospective ones (platform-variant globs, prospective entries). Label those **KIND** where
they live, or the next agent will obey the hint and remove them. Its `project` globs are
also an enumerated scope in the §6.1 sense: workspaces or top-level directories outside
them are invisible, so either widen the globs with the repo or name the scope in §6.4.

**The import graph (intents 13 and 14).** These are the same tool in most ecosystems, and
they are what turn `file-structure.md` from prose into a gate: `dependency-cruiser` for JS/TS
(it does both, and its `no-circular` is the cheapest real rule in this skill),
`import-linter` for Python, `go-arch-lint` or `golangci-lint`'s `depguard` for Go, ArchUnit
on the JVM. Two things to get right:

- **Circular imports may already be impossible.** Go's compiler rejects an import cycle
  outright, so intent 14 is **n/a** there, for free — the distinction §2 draws between *n/a*
  and *prose-only*, and the reason to check before installing a tool to find zero of them.
- **On TypeScript, make the cruiser see type-only imports.** dependency-cruiser's
  `tsPreCompilationDeps` defaults to **false**, and compilation erases `import type` — so
  both the boundary rule and `no-circular` are blind to every type-level edge, and a deep
  `import type` of a module's internals exits 0 while the same import as a value exits 1.
  Set `tsPreCompilationDeps: true` and take the re-baseline it causes; prove it with a
  planted type-only deep import, not just a value one.
- **The boundary rules need a map, and the map is the artefact that rots.** Write the
  module → public-entry table as data the config compiles into rules, not as hand-written
  regexes: a new module missing from the map must be *added to the map*, never fixed by
  loosening a pattern, and that distinction only survives if the two are separate files. Then
  the rule is one line — every import of a module resolves to its public entry — and the
  review question becomes "is this map current", which a human can answer.

Land 13 as a ratchet on any existing repo. Deep imports are the single most common thing a
codebase has hundreds of, and a gate that lands red teaches the team the gate is advisory
(§5, *Violations the install itself introduced*).

**Test hygiene (intent 15).** A committed `.only` silently disables the rest of the suite,
and a committed `.skip` is a test that reads as passing. Both are ordinary lint rules living
in a plugin most repos never install: `eslint-plugin-vitest` / `eslint-plugin-jest`
(`no-focused-tests`, `no-disabled-tests`), and their equivalents elsewhere. Where the
ecosystem has no focus mechanism, mark it n/a. This is the cheapest gate in the skill and the
one most often left as prose in `testing.md`.

## 5. Land it on an existing codebase — ratchet, never loosen

A fresh repo passes immediately. A real one won't. Run every gate, count the
violations, and pick per gate:

(If the repo carries a **previous, unfinished run of this skill** — staged or uncommitted
gate configs, a half-written baseline — that work is yours now: verify each piece as if you
wrote it and finish or revert it. Never layer a second parallel install beside it.)

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

Some tools have **no commentable format at all** — `jscpd`'s `.jscpd.json` is plain JSON, and
a comment there makes **auto-discovery** skip the entire config silently: no threshold, a
different file count, no error. For those: keep the config comment-free and put the reasons in
a sibling file that already holds them (the file-length exemption list is the natural home).

Then close the hole rather than documenting it. **Where naming the config explicitly makes the
tool parse instead of discover, wire that flag into the gate command** — `jscpd --config
.jscpd.json …` prints `config file .jscpd.json line 1: expected value` and exits non-zero on
the same malformed file that auto-discovery ignores. One flag converts a fail-open into a
fail-closed, which is worth more than any instruction telling a future reader to check.

And whatever you leave for that reader, **do not write a re-prove command whose polarity you
assumed**. Run it in both states — config healthy and config deliberately broken — and keep it
only if the two differ. `jscpd … -t 0` is the cautionary case, and it fails in both directions:
on a repo whose clones are all exempted it exits 0 healthy and 1 broken (the reader gets the
answer exactly backwards), and on a repo with any surviving duplication it exits 1 in *both*
states and distinguishes nothing. The signal that does discriminate is the **analysed file
count**, or a throwaway clone pair planted inside an ignored path and outside it. A detector
nobody ran in both states is not a detector.

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

   - **Conditional compilation.** Files behind a build tag or platform constraint (GOOS
     filename suffixes, `.web.tsx`/`.native.tsx` variants) are invisible to a linter run
     without that tag — thousands of lines, silently, while the rules claim them. This escape
     outlives the install, so it goes in the repo's §6.4 list like any other enumerated
     scope — disclosed only in your install report, it is read once and lost.
   - **A nested module or workspace** below the root the gate is invoked from. The run stops at
     the boundary and exits 0.
   - **A default include list** in the linter's own config that predates you.

   The set of files the gate reads must equal what `rules/` claims to govern. Where it can't,
   narrow the rules' claim to match — an unreachable claim is worse than a smaller one,
   because an agent believes it.

   **A gate invoked on a list of directories is pinned to the directories that exist today.**
   `jscpd src scripts` and a file-length glob of `src/**` both go dark the day someone adds a
   top-level `lib/` — and unlike the wrapper case, nothing looks wrong: the gates still run,
   still pass, still report. Only the linter invoked as `.` follows the repo. So invoke each
   gate at the repo root with ignores, rather than at an allowlist of paths; where a tool
   forces you to enumerate, the enumerated scope goes in the §6.4 "what this does not catch"
   list by name. Two of three gates silently narrowing is the difference between a gate and a
   habit.

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

   Two inherited-hook cases the rule above doesn't decide for you. An existing hook that is
   already whole-repo (format + lint + typecheck over everything) stays whole-repo —
   consistency with the hook you inherited beats the staged-files preference; say which you
   chose and why. And a hook that is **red for a reason unrelated to your gates** (a
   pre-existing typecheck failure in a stage you didn't add) is not yours to absorb
   silently: fix it in its own commit when the fix is mechanical, otherwise report it as a
   blocker — either way the report names it, or the gate gets blamed for the hook.

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

  When the hosted CI itself is unreachable from the install session, the honest fallback is
  **emulation**: run the workflow's steps, in order, on the toolchain the pin resolves —
  and report it as emulation, never as a CI run. That is a real proof of the pinned-version
  agreement; it is not a proof of the runner's environment, and the report says which claim
  it makes.
- **A hook running from the repo root does not load per-workspace state.** Piping staged
  paths to a root-level linter skips the baseline or suppression file sitting in each
  workspace, so the hook rejects exactly the recorded debt that `quality` and CI accept —
  every ratcheted file becomes uncommittable. Run the linter per workspace, or point it at
  the right state file.
- **A workspace with no config of its own falls through to the root config**, whose patterns
  anchor at the *root* — a block scoped `files: ["src/**/*.{ts,tsx}"]` matches nothing there,
  and that workspace silently loses whichever intents the block carried. So the §6.1
  enumeration runs per workspace, not once at the root.
- **The three contexts must run the same *tool*, and a pinned version in a variable is not a
  pin.** Vendoring the linter into the repo (`./bin/<tool>`, a `tools.go`, a lockfile entry) is
  the right move — it is what kills the exit-127 in §6.1 — but the bootstrap is usually a
  file-existence target: `./bin/<tool>` exists, so nothing runs, so the version constant next to
  it is decorative. Local then runs whatever binary happens to sit there while CI, cold every
  run, installs the pinned one. Replace that binary with `#!/bin/sh\nexit 0` and the gate
  reports green — the whole config, every exemption, every proof above, bypassed by one stale
  file. **Have the gate check the tool it is about to run** (`<tool> --version` matched against
  the pinned constant, re-bootstrapping on mismatch), and prove it by running the wired command
  against a deliberately wrong binary. The version constant must be load-bearing, not a comment.
  The check must **execute the binary** — comparing a manifest or lockfile entry to the pin
  checks the package metadata, and a stubbed `.bin` script passes every manifest comparison
  while gating nothing. Even executed, this is a staleness guard, not an integrity guard —
  a stub that echoes the pinned version string still passes — so don't claim more for it
  than it does.

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

The sweep covers **every agent-docs file, not just `rules/`** — and the claim most often
missed is the **host profile**. A `CLAUDE.md` that says "the host needs only Docker and
bun" is false the moment the wired gate or the pre-commit hook shells out to a host `go`
or a user-GOPATH binary: a fresh checkout on the documented profile then can't commit.
Either make the gate honor the documented profile (run the tool through the container or
the package runner) or update the claim — in the same commit as the gate that broke it.

## 7. Report

Per gate: the intent, the rule name(s) actually resolved and their source, the number
landed, and the starting violation count. Then: which intents came back **n/a** (the
language has no such construct) versus **prose-only** (it applies but this toolchain can't
check it) and why, the script name, whether pre-commit and CI are wired, and the path to
the exemption list with its current size.

Five lines that are easy to omit and are the whole point of the run:

- **What the gate covers, proved.** Name the directory you planted the violation in and
  that it came back an error, plus the result of the enumeration diff (§6.1) — how many files
  the gate read against how many `rules/` claims. "Configured" is not the claim; "fires" is.
- **Does the wired command run — in all three contexts?** Its exact exit code from a clean
  shell, from the pre-commit hook, and on CI's pinned toolchain (§6a), plus how many of the
  configured rules resolve to `warn` and therefore can never fail it.
- **Which gates are pinned to a path list rather than the repo** (§6.1), and whether the gate
  verifies the version of the tool it runs (§6a). Both are green-looking holes: the first
  narrows the day a directory is added, the second the day a binary goes stale.
- **Is `quality` green right now?** If not, say what's red and why it was left that way.
- **Which exemptions are blanket rather than scoped**, and for any tool that ratchets by
  count, that magnitude in those files is ungated. This is the sentence a reader most needs
  and is least likely to derive on their own.

Point the user at the one file to edit when a cap needs to change — and remind them that
the matching `rules/` prose changes in the same commit.
