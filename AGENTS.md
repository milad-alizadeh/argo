# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. Read by both Claude Code and Codex.

## Agent skills

- **Issue tracker** — Issues and PRDs live in GitHub Issues on `milad-alizadeh/argo`, via the
  `gh` CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels** — five canonical triage roles, each label string equal to its name. See
  `docs/agents/triage-labels.md`.
- **Domain docs** — single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See
  `docs/agents/domain.md`. The vocabulary is inlined under **Domain model** below. `CONTEXT.md`
  is now an index and the sections are files under `docs/domain/`, so read the one section you
  need rather than the whole model. No harness auto-loads any of it. The reasoning *behind* each
  term lives in `docs/domain/rationale.md` — read that only when changing a term.

## Task tracking

Maintain a live to-do list for any task with **three or more distinct steps**, edits across
**multiple files**, or **a plan the user approved**. Claude Code: `TodoWrite`. Codex:
`update_plan`.

- Write the list **before the first edit**, not as a retrospective summary.
- Exactly **one** item `in_progress` at a time; mark it `completed` the moment it is done, not
  in a batch at the end.
- One item = one verifiable outcome. "Fix the bug" is a task; "read the file" is not.
- Keep single-step edits, lookups, and conversational turns off the list — a one-item list is
  noise, and a list nobody needed teaches the next session to ignore lists.

## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code, any language** — `engineering-principles.md`, `code-style.md`,
  `comments.md` (a comment is **one line** unless a future edit could make it false;
  nothing here is published, so `///` earns no more room than `//`),
  `file-structure.md`, `dependencies.md`
- **TypeScript** — also `typescript-style.md` (how TS spells `code-style.md`)
- **Swift** (`apps/macOS`) — also `swift-style.md` (how Swift spells it, SwiftUI included)
- **Tests** — also `testing.md`
- **UI work** — also `ui-components.md`, `design-system.md`, `designs.md`
- **Skill authoring** — also `skill-authoring.md` (any `SKILL.md`)

### Module boundaries

`apps/macOS`'s three layers — `ArgoEngine` ⊥ `ArgoUI` ⊥ the app target — are enforced by
`scripts/swift-boundaries.sh` (in `quality:swift`, on the `macos` CI job and in pre-commit).
Every edge is checkable from imports and declarations alone, which is why they are gates rather
than review notes. Four are ADR-0022's layering; the sharpest of those is **exactly one file in
`ArgoUI` may read live Hub state** — the Hub → cockpit projection. Everything else takes a value.

The fifth is ADR-0027, on that projection: the cockpit **restates** `HubSession` rather than
holding one, so every public engine fact must land in the mapping or be named on a
`not-projected:` line beside it, **on the slot of its own name** unless a `renamed:` line says
why not. Adding a public fact to `HubSession` fails the build until you say which it is; swapping
two same-typed facts between slots fails it too.

The sixth extends the parameter cap to initializers, which SwiftLint's own rule cannot see. Its
ratchet is recorded in `.swiftlint.yml` beside the rule it extends, and the script reads it from
there — one cap, one place.

The JS/TS boundary gates are dormant — no subject since ADR-0023 retired the Electron
cockpit. Their scripts stay in `scripts/` for consumers; history and shape: ADR-0021, ADR-0023.

### Quality gates

The arithmetic half of those rules is a build failure, not a review note, and every rule in
`bun run quality` is an **error, never a warning**. Write to the caps rather than waiting to
be told: 50 lines per function, cognitive complexity 15, 3 parameters, a 150-line file ceiling
counting code lines only, and whole-tree duplication under 1%.

When a gate fires, fix it or ratchet it — **never suppress it inline and never raise a global
cap.** Two of the configs fail open when commented, so `quality:duplication` keeps its explicit
`--config .jscpd.json` and neither is ever proved by exit code alone. What runs on which CI
job, where an exemption goes, and the verification recipe: `docs/agents/quality-gates.md`.

## Session isolation

Multiple agent sessions run against this repo concurrently. Implementation work (ticket
builds, any multi-file change) must **never** run in the shared main checkout: if your cwd is
the repo root rather than a path under `.claude/worktrees/`, enter a worktree first (Claude
Code: the `EnterWorktree` tool — this section is your standing instruction to use it,
**unprompted**; other harnesses: `git worktree add`) and commit to a ticket branch there.
Read-only work (review, triage, Q&A) may stay in the main checkout. `scripts/worktree-guard.mjs`
enforces this on agent `Edit`/`Write` to `apps/**` and `packages/**`; doc, memory and config
edits stay free.

Everything else about worktrees — naming, resuming, recovery, the sub-agent rule, and reaping
landed ones with `bun run worktrees:gc` — is in `docs/agents/worktrees.md`, and applies to
**all** implementation work, not just `/implement` runs.

## Cross-CLI guardrail hooks

`hooks.json` (repo root) is the neutral SSOT for the four guardrail hooks (placement write
guard, worktree edit guard, worktree naming guard, worktree-gc), projected per-harness. **Edit
`hooks.json`, then run `bun run hooks:sync`** — it regenerates `.claude/settings.json` and
`.codex/hooks.json`; never hand-edit those blocks. Consumers opt in via `scaffold.mjs --hooks`,
and re-scope the edit guard to their own layout with `worktreeGuard.roots` in the same file.

A script named in `hooks.json` must also be in `MANAGED_MARKERS` (`hooks-sync.mjs`) or the
projection grows a duplicate on every run. `test:hooks` fails when it isn't.

## Skill bundle

A `/command` the user typed is **already loaded** — its instructions are in the turn. Follow them
directly; never call the `Skill` tool for it. Some skills (`implement`) refuse a model-issued
invocation outright, so the extra call is a rejected no-op rather than a second run.

The repo-root `skills-lock.json` is the bundle manifest **and** this repo's own install record.
`bun run scaffold` (= `npx github:milad-alizadeh/argo`) installs from it with one
`npx skills add` per source; `--skill a,b` installs a subset.

`skills add` only ever adds, so **renaming or deleting a skill means deleting the installed copy
by hand** — dropping the `skills` entry uninstalls nothing, and the stale copy goes on
advertising itself, two skills competing for the same prompts.

The set is **deliberate** — a lock has no `"*"` wildcard, and editing one of Argo's own skills
needs a push to `main` before a reinstall sees it. Add/sweep workflow:
`packages/argo-skills/README.md`.

## Code review

An implement run reviews its diff before the PR opens. The review only works in a **fresh
context that never saw the author's reasoning**. Claude Code: `code-review` fans out parallel
axis sub-agents via the `Agent` tool. Other harnesses: run the review from a separate fresh
session over the diff.

If no independent fresh context is reachable, **stop and report that** — do not run the axes
yourself and present it as a review. Claude Code trap: agents spawned inside a `Workflow` have
no `Agent` tool, so run implement directly, not nested in a Workflow.

## Design work

A UI ticket whose screen has a design in `docs/designs/` is built with **`design-to-code`**,
not `implement`. The design carries measurements the ticket's prose does not, so a screen built
without it drifts from what was agreed and nothing downstream can tell that drift from a bug.

The route in full — `/prototype` explores variants, `prototype-to-design` approves one and lands
it with a render, `design-to-code` builds it per ticket, `pixel-review` judges the pixels. This
is a **repo rule, not a skill description**: which tickets take the design route depends on what
is in `docs/designs/`, which no portable skill can know. `ask-argo` maps the rest.

## Visual verification

Nothing renders a view on CI, so **rendering is a thing YOU do**. Run `/pixel-review` for a
pixel- or spec-level check, and look at the affected states before calling a visual change done.

Two things that bite before you have read anything: a screenshot needs Screen Recording
permission or the PNG is silently blank, and **an e2e run holds the real keyboard and mouse for
its whole length — say so and wait before starting one**, because it takes the machine out from
under whoever is at it.

The same shape, and it costs more: **never hand-roll a load generator — use `sh
scripts/load-burst.sh <workers> <seconds>`**, because spinners orphaned by a dying shell hold no
deadline of their own and run until a human notices (five times now, once for 7h54m). Cleanup is
scoped to what you started — stop a run early with `--reap <token>`, the token it prints, and
never a bare `pkill -f load-burst.sh`, which is another session's outage; `bun run load:orphans`
names ownerless CPU hogs and kills nothing.

The commands (whole-app, one specimen, e2e) and everything else — why the script quits a
running Argo, what the pixels are judged against, the specimen harness in full:
`docs/agents/visual-verification.md`.

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context. The
global Bash hook (rtk ≥ 0.45) auto-wraps `git`, `grep`, `gh`, `ls`, `find` and similar, and it
rewrites inside compound commands too — `cd apps/macOS && swift test` is caught. This repo's own
noisy entrypoints are covered by **`.rtk/filters.toml`** at the root: `swift build`, `swift test`,
`bun run test|quality|…` and `sh scripts/e2e-test.sh`.

Two traps, both silent. rtk reads that file **from the working directory only**, so a new run
location needs a `.rtk` symlink back to the root one or its commands are filtered by whatever
else matches. And the filters are inert until **`rtk trust --yes`**, which keys on the file's
hash — re-run it per checkout and after any edit. Neither failure prints a warning. Why, and the
rule that these filters bound output from the tail and never the head: `docs/agents/rtk-filters.md`.

```bash
rtk err bun run quality:swift       # SwiftFormat --check, SwiftLint, package boundaries
RTK_DISABLED=1 git diff             # exemption: a review's input diff must be complete —
                                    # never let a filter truncate what /code-review reads
```

There is no `typecheck` script any more — it ran `tsc` over `apps/desktop`, and no workspace
carries TypeScript sources to check (ADR-0023).

## Domain model

The full model lives under `docs/domain/`, one file per section, indexed by `CONTEXT.md` at
the repo root. None of it is loaded into every session, because the whole model costs about
8,200 tokens. Read the one section you need when you are changing the model, naming something
new, or you need the exact rule behind a term. Swift comments cite it by section name, like
`CONTEXT.md L1 · Binding`, and the index maps every one of those names to its file.

The vocabulary below is the part every session needs. Use these words, never a synonym.

**L1 · Organisation**

- **Project** — one registered git repo, keyed by a stable id. The scope of one cockpit window.
- **Account** — one authenticated identity with a provider. One grant, one token in the keychain.
- **Binding** — a Project's use of one Account through one port, plus the provider-side scope.
- **Ticket** — one unit of work owned by a provider. Argo stores the link, never the content.
- **answer** — the resolved text of a decision ticket, held verbatim.
- **Delivery** — the product in flight, derived per branch from git plus the code host.
- **Person** — `me` or `other`.

**L2 · Session**

- **Session** — one logical resume-chain, and the root Agent. Stored as `managed` or `external`.
- **orphaned** — a managed Session whose owning process is gone. Read-only until selected, which
  resumes the chain in a fresh process and makes it `managed` again (ADR-0026).
- **Session status** — `running · permission · asking · idle · stopped · ended · unknown`.
- **Transcript file** — the physical per-file CLI record. Never itself called a Session.

**Honesty tier** — a property of each rendered fact, not of a session.

- **DIRECT** — Argo owns the fact. **DERIVED** — observed from outside Argo. **CONVENTION** —
  arrived over the companion plugin.
- **degrade-down** — ambiguity resolves to the lower tier or the quieter state, so Argo never
  renders a false DIRECT.

**L3 · Runtime tree**

- **Agent** — a node in the execution tree. It is the root when `parentId` is null.
- **Subagent** — a non-root Agent. **Turn** — one exchange, prompt in to stop reason out.
- **Message** — what the agent said. **Thought** — what it reasoned. Both sit in one ordered sequence.
- **Tool Call** — one observable action. Its **Result** is a `diff`, `output` or `media` value.
- **Plan** — the agent's live to-do list. Session-scoped and replaced whole.
- **Workspace** — the git working context. It holds `branch`, which is the join key.
- **Compaction** — a marker where history was condensed. **Usage** — token, cost and context telemetry.

**L4 · Delivery detail**

- **Diff** — a Delivery's change-set, branch against base, addressed by commit SHA.
- **Review** — one submitted review round. **Finding** — one resolvable issue inside it.
- **Check** — one CI check, name taken verbatim from the code host.
- **Outcome** — what a Session produced. Session-keyed and persisted.

**Autonomy** — **Mode** (`Read Only | Plan | Code | Auto`, each rung a boundary the agent asks to
cross), **Permission** (a per-action prompt), **Standing
allow** (one tool that stopped asking), **Permission expiry** (Argo's own clock refused it), and
**Gate** (Argo's policy on a Delivery step).

**Ports** — **Ticket provider** and **Code host**. An **MCP server** is not a port, because it
is something an observed Session connects to rather than something Argo reads through.

**Surfaces, not entities** — Cockpit, Roster, Panels, rooms. The **Hub** is the in-memory
projection that assembles the join.
