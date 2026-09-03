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

- **All code** — `house.md`: what no linter checks and a model does not do unprompted. The
  arithmetic (length, complexity, arity, escape hatches) is a gate, not prose: `biome.jsonc`
  and `.swiftlint.yml` are where those numbers live.
- **Swift and the cockpit** (`apps/macOS`) — also `swift.md`: the Swift spelling, the views,
  the token contract, rendering.

### Module boundaries

`apps/macOS`'s layers, `ArgoEngine` ⊥ `ArgoDesign` → `ArgoAtoms` / `ProseText` →
`MermaidLayout` → `MermaidView` → `ArgoUI` ⊥ the app target, are nine gates in
`scripts/swift-boundaries.sh` (in `quality:swift`, on CI and in pre-commit). Each failure message
states its rule. The four you hit most: **exactly one file in `ArgoUI` reads live Hub state**; a
public `HubSession` fact lands in the cockpit mapping or on a `not-projected:` line; an initializer
over the parameter cap needs a named `# INIT:` line in `.swiftlint.yml`; a colour, rhythm step,
radius, stroke or type size is declared only in `ArgoDesign`. The edges in full, with their
reasoning: `docs/agents/module-boundaries.md`.

### Quality gates

Every rule in `bun run quality` is an **error, never a warning**, and the caps live in
`biome.jsonc` and `.swiftlint.yml`, not in prose. When a gate fires, fix it or ratchet it in the
config: **never suppress inline, never raise a global cap.** Two of the configs fail open when
commented, so no gate is proved by exit code alone. What runs on which CI job, where an exemption
goes, and the verification recipe: `docs/agents/quality-gates.md`.

## Session isolation

Implementation work (a ticket build, any multi-file change) runs in a worktree under
`.claude/worktrees/`, never in the shared main checkout: from the repo root, enter one first
(Claude Code: `EnterWorktree`, unprompted; other harnesses: `git worktree add`) and commit to a
ticket branch there. Read-only work (review, triage, Q&A) may stay in the main checkout.
Naming, resuming, recovery, the sub-agent rule and `bun run worktrees:gc`:
`docs/agents/worktrees.md`.

## Cross-CLI guardrail hooks

`hooks.json` (repo root) is the neutral SSOT for the three guardrail hooks (worktree edit
guard, worktree naming guard, worktree-gc), projected per-harness. **Edit
`hooks.json`, then run `bun run hooks:sync`** — it regenerates `.claude/settings.json` and
`.codex/hooks.json`; never hand-edit those blocks. Consumers opt in via `scaffold.mjs --hooks`,
and re-scope the edit guard to their own layout with `worktreeGuard.roots` in the same file.

A script named in `hooks.json` must also be in `MANAGED_MARKERS` (`hooks-sync.mjs`) or the
projection grows a duplicate on every run. `test:hooks` fails when it isn't.

## Skill bundle

A `/command` the user typed is **already loaded**; follow it directly and never call the `Skill`
tool for it. `skills-lock.json` is the bundle manifest and this repo's install record; `bun run
scaffold` installs from it. `skills add` only adds, so renaming or deleting a skill means deleting
the installed copy by hand, and editing one of Argo's own skills needs a push to `main` before a
reinstall sees it. Add/sweep workflow: `packages/argo-skills/README.md`.

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
is in `docs/designs/`, which no portable skill can know.

## Visual verification

Nothing renders a view on CI, so **rendering is a thing YOU do**: run `/pixel-review` and look at
the affected states before calling a visual change done. A screenshot needs Screen Recording
permission or the PNG is silently blank. **An e2e run holds the real keyboard and mouse for its
whole length: say so and wait before starting one.** **Never hand-roll a load generator; use `sh
scripts/load-burst.sh <workers> <seconds>`** and stop it with the `--reap <token>` it prints, never
a bare `pkill`. Commands and the specimen harness: `docs/agents/visual-verification.md`.

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context; the
global hook auto-wraps `git`, `grep`, `gh`, `ls`, `find`, and `.rtk/filters.toml` covers this
repo's noisy entrypoints. Two silent traps: rtk reads that file from the working directory only,
so a new run location needs a `.rtk` symlink back to the root; and the filters are inert until
`rtk trust --yes`, re-run per checkout and after any edit. A review's input diff must be
complete: `RTK_DISABLED=1 git diff`. Why: `docs/agents/rtk-filters.md`.

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
- **Entry** — how the process was started: `interactive` (a person at a terminal) or `headless`
  (a program did, `claude -p`). DERIVED off the CLI's own `entrypoint`; anything absent or
  unrecognised reads `interactive`, so an unknown word never folds a Session somebody is driving.
- **Session status** — `starting · running · permission · asking · idle · stopped · ended ·
  unknown`. `starting` is DIRECT and managed-only: Argo started the process and has not heard it
  yet, and the child's first bytes on the PTY end the claim.
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

**L4 · Delivery detail, Autonomy, Ports, Surfaces** — Diff, Review, Finding, Check, Outcome;
Mode, Permission, Standing allow, Permission expiry, Gate; Ticket provider, Code host; Cockpit,
Roster, Panels, Hub, Fold. Each is defined in its `CONTEXT.md` section: read it before naming,
rendering or changing one of them.
