# Argo

Monorepo for the Argo skills bundle and the Argo cockpit. `apps/desktop` is the Electron cockpit;
`apps/macOS` is the deprecated Swift app, kept for reference only.

## Where things are written down

- **Issues and triage labels**: GitHub Issues on `milad-alizadeh/argo`, via `gh`. Label every
  issue in the `gh issue create` call. Attach screenshots through github.com in Chrome. Read
  `docs/agents/issue-tracker.md`, and `docs/agents/triage-labels.md` before triage.
- **House rules**: below, for every path. `apps/desktop/AGENTS.md` adds its own: **read it before
  your first edit there.** Rules for another directory go in an `AGENTS.md` there.
- **Domain model**: `docs/domain/`, indexed by `CONTEXT.md`; read `docs/agents/domain.md` first.
  Use the model's words, not synonyms, and cite it in comments as `CONTEXT.md L1 · Connection`.
  Change a term only after `docs/domain/rationale.md`. A concept the model does not name is either
  an invented name to reconsider or a gap to record.
- **Decisions**: `docs/adr/`. Read the ones covering an area before changing it. When your work
  contradicts one, say so: *Contradicts ADR-0026, but worth reopening because…*
- **Guardrail hooks**: before editing hooks, read the `$comment`s in `hooks.json`.
- **Skill bundle**: before adding, removing or renaming a skill, read `packages/argo-skills/README.md`.
- Load `/writing-for-agents` before drafting or materially editing agent instructions
  (`AGENTS.md`, `SKILL.md` and similar).
- Load `/simple-english` before drafting text for a person: issues, comments, PR titles and
  bodies, user questions, grilling rounds, and agent Markdown people read.
- For work with three or more steps, several changed files, or an approved plan, read
  `packages/argo-skills/skills/setup-argo-skills/templates/task-tracking.md` before the first edit.

## Gates

**CI is the only gate**; there are no git hooks. `.github/workflows/ci.yml` lists every step, and
`bun run quality` is the local subset, wider than biome alone. A `macos-26` job packages and tests
`apps/desktop` when a PR touches it, the root manifest, the lockfile or `.github/`.

When a gate fires, fix it or ratchet it in `biome.jsonc`: **never suppress inline, never raise a
global cap.** Both configs fail open when commented, so exit code alone proves nothing. Where each
gate fails open: `docs/agents/quality-gates.md`.

**Node 24 is the minimum**; `.node-version` holds the exact pin. After a Node major switch, delete
`node_modules` and reinstall: `node-pty` is bound to the ABI.

Desktop releases: ADR-0036 and `apps/desktop/README.md`.

**`apps/macOS` is verified by nothing.** A Swift change says in the PR body whether it was checked
by hand.

macOS CI runners are free for this repo. The limits are 5 concurrent macOS jobs and no secrets on
fork PRs.

## Landing

**Only `/ship` pushes a work branch or opens a PR**, and an agent may invoke it. Every other run
ends at the reviewed diff, committed on its branch. A hook denies both commands unless prefixed
`ARGO_SHIP=1`, which only `/ship` writes.

An implementation gets one review pass. Fix its actionable findings, then commit without starting
another review pass just to check those fixes.

**What leaves the base says so in a commit trailer**: `Removes-test: <name>`,
`Removes-file: <path>`, `Reverts-file: <path>` (or `*`). A reviewer is the check:
`docs/agents/landing.md`.

**Merging is the human's.**

## Session isolation

**Every** change, a doc or config fix included, runs in a worktree under `.claude/worktrees/`.
From the repo root:

```bash
git worktree add -b 'argo/#<N>-<slug>' .claude/worktrees/ticket-<N>-<slug>
```

then `EnterWorktree { path: ".claude/worktrees/ticket-<N>-<slug>" }`, or `cd` into it.
`EnterWorktree` without a `path` is refused.

Read-only work may stay in the main checkout. A `Bash` write or a commit counts as a change; a
deliberate main-checkout commit takes an `ARGO_MAIN_COMMIT=1` prefix. No-ticket naming, resuming,
recovery and subagents: `docs/agents/worktrees.md`.

## Subagents

Set model and reasoning effort explicitly on every dispatch; an omitted value inherits the
parent's. Pick the lowest tier that can finish the bounded task: cheap and low effort for contained
research, read-only inspection and mechanical edits; higher only for sustained reasoning, ambiguous
design, broad code understanding or high-risk verification. The parent model is the ceiling.
Report model, effort and the task requirement that earns it.

## Visual verification

Every capture is disposable: a temp dir, looked at, deleted. No gate or git ref holds a screenshot.
The `storybook-links` section of a PR body belongs to CI; the rest is the author's.
`docs/agents/visual-verification.md` is `apps/macOS`-only.

## House rules

What no linter checks. Caps and formatting are `biome.jsonc`'s.

### Code

- **Ground external calls.** Write every call into an API you don't own against a source opened
  this session: installed declarations, an existing call site, or current docs. If you can't,
  say so.
- **Names are words.** `percentage` not `pct`, `context` not `ctx`, `repository` not `repo`,
  labels included. Exceptions: a domain acronym (`URL`, `ID`) and a platform-fixed name.
- **Branch on a closed set with the exhaustive construct**; chained `if` is for open conditions.
  When the discriminant only picks a value, use a lookup.
- **Validate at the boundary.** Parse outside data into a known shape once, at the edge; a cast or
  all-optional model in place of a check is a bug moved inward. A shape the parser does not
  recognise is reported and counted, never passed on as a fallback or dropped.
- **One source of truth.** Extract a literal before its second paste. A new variant of an existing
  kind is one new file plus one registration line.
- **Group by domain, never by kind.** `Tickets/`, not `Helpers/`. A helper starts in its only
  caller's file and moves out when a second caller appears.
- **One folder, one secret.** A folder hides one decision that could change (Parnas 1972), at every
  depth. Finish "everything in here knows X, and nothing outside knows X", then check one change to
  X touches only this folder. Needing an "and" means a pile. `util`, `common`, `shared`,
  `helpers`, `components` and `hooks` name folders that hide nothing.
- **Typed script source.** Node scripts are `.mts`; only the two `.mjs` files in `biome.jsonc` are
  exempt.
- **Only what's needed.** No knob, layer or hook for a need that doesn't exist yet. Delete dead
  code on sight.

### Comments

One line, for `//`, `///` and `#` alike. A fact a future edit could falsify (a measured number, a
framework behaviour, a defence of odd-looking code) takes the length it needs. Cut arguments,
rejected alternatives, WHAT-restatements, tombstones and history; a bare `#412` on the line is
enough.

### Tests

- **Assert what happened, never that a function was called.**
- **Model XState paths**: test a bounded machine with paths from `xstate/graph`, asserting
  observable outcomes; add focused tests for what paths cannot express.
- **Mock only what you don't control and can't afford live**: a paid API, a clock, an unreachable
  network.
- **Name the claim in the domain's words** (`rejects an expired token`), one behaviour per test;
  several inputs for one behaviour is one parameterised case.
- **Each test builds its own state** and passes alone, in any order, in parallel.
- **Prove a regression test by reverting the fix.** It goes red on the bug with the reported
  symptom, green with the fix, then red again with only the fix reverted and green once restored.
  Revert with `git apply -R` on a patch of the fix: the stash stack is shared across worktrees.
- **A repeated symptom is a missing invariant.** Before fixing a bug, search closed issues for
  its symptom. On a match, link them, name the invariant every cause broke, and test that
  invariant across every path that reaches the symptom, not the new cause alone.
- **Test an outside format against recorded real data.** A hand-written fixture holds only the
  shapes you already knew; a recorded corpus from the real producer catches the next one.

## Tooling (RTK)

**Prefix shell commands with `rtk`.** rtk reads `.rtk/filters.toml` from the working directory
only, so a new run location needs a `.rtk` symlink to the root, and filters are inert until
`rtk trust --yes`, re-run per checkout and after any edit. A review's diff must be complete:
`RTK_DISABLED=1 git diff`. Details: `docs/agents/rtk-filters.md`.
