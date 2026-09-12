# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. The cockpit is mid-migration:
`apps/macOS` is the deprecated Swift app, kept for reference, and `apps/desktop` is the Electron
replacement being built on #1730. Read by both Claude Code and Codex.

Everything here is a fact about this repository. Process belongs to the skill that owns it.

## Where things are written down

- **Issues, PRDs and triage labels** — GitHub Issues on `milad-alizadeh/argo`, via `gh`. A
  screenshot reaches a body only when a person drags it in; an agent records the Storybook route
  instead, and keeps its own captures in a temp dir. Every issue is
  labelled in the `gh issue create` call and never afterwards, and each label string equals its
  role name, so a vendored skill naming a role names our label. `docs/agents/issue-tracker.md`.
  Before triage, read `docs/agents/triage-labels.md`.
- **House engineering rules** — *House rules* below, for every path. `apps/desktop` adds its own
  in `apps/desktop/AGENTS.md`: **read it before your first edit there.** Claude Code loads it
  when it reads a file there, and Codex only when started inside it. Rules for another directory
  go in an `AGENTS.md` there, beside a `CLAUDE.md` holding only `@AGENTS.md`.
- **Domain model** — `docs/domain/`, indexed by `CONTEXT.md`.
  Before domain exploration, read `docs/agents/domain.md`. Read the one
  section you need before naming or changing a term, and use its words rather than a synonym.
  Code comments cite it as `CONTEXT.md L1 · Binding`. Change a term only after
  `docs/domain/rationale.md`. A concept the model does not name is a signal: either the name is
  invented and wants reconsidering, or the gap is real and wants recording.
- **Decisions** — `docs/adr/`. Nothing loads these. Read the ones covering an area before
  changing it, and when your work contradicts one, **say so rather than quietly overriding it**:
  *Contradicts ADR-0026, but worth reopening because…*
- Load `/writing-for-agents` immediately before you draft or materially edit instructions for
  agents. This includes `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, and similar files. Ordinary code edits
  do not trigger it.
- Load `/simple-english` immediately before you draft text for a person. This includes issue titles
  and bodies, comments, close messages, PR titles and bodies, user questions, and grilling rounds.
  Also load it for agent-facing Markdown that people will read. Ordinary implementation work and
  progress commentary do not trigger it. Apply it while you draft, not as cleanup.

## Desktop Session adapters

Before changing desktop Session observation, transcript discovery, or a CLI parser, read
`docs/adr/0021-placement-is-declared-per-module.md` and
`docs/adr/0024-session-drive-port-two-adapters.md`. A CLI owns one adapter under
`apps/desktop/src/agents/<cli>/`: its filesystem layout, parser, fixtures, and proof cases live
there. Shared Session code holds only the IPC contract and projections. Register an adapter once;
do not branch on a CLI or filename in shared code.

`apps/desktop/scripts/` holds generated output and runtime wrappers. Product behavior and proof
sources are TypeScript under `apps/desktop/src/`; the package build generates runnable `.mjs`
drivers. Do not add product behavior to `scripts/`.

## Gates

Before code review, read `docs/agents/code-review.md` for repository references and focused-test boundaries.

**CI is the only gate.** There is no git hook: no pre-push, and no pre-commit since #1911 took
husky and lint-staged out. `.github/workflows/ci.yml` names every
step it runs on Linux and `bun run quality` is the local subset; read the step list there, never
a copy of it. `quality` is wider than biome, so biome alone leaves a typecheck or a duplication
breach for CI. A `macos-26` job packages and tests `apps/desktop` (#1769) when the PR touches
`apps/desktop`, the root manifest, the lockfile or `.github/`.

When a gate fires, fix it or ratchet it in `biome.jsonc`: **never suppress inline, never raise a
global cap.** Both configs fail open when commented, so no gate is proved by exit code alone.

**Node 24 is the minimum**, declared in the root `package.json` `engines` and checked by nothing
(#1951). CI installs the version in `.node-version` through `node-version-file:`, the one place
it is written. After switching Node's major version, delete `node_modules` and reinstall:
`node-pty` is a native addon bound to the ABI.

**A desktop release publishes only on a passing verdict** (#1807, ADR-0036). `release.yml` is
`workflow_dispatch` only, signs and notarizes, writes one `release-verdict.json` naming the SHA-256
of every artifact it judged, and creates the release as a draft that a later step flips. A
published release cannot be unpublished — GitHub freezes `draft` and `tag_name`, so `DELETE` is the
only removal and it burns the tag name forever — so `release-backstop.yml` runs on
`release: [published]`, files an issue with the evidence and then deletes the release. The
certificate, the App Store Connect key, the `release` Environment and the immutable-releases
setting are the human's, and the checklist is in `apps/desktop/README.md`. None of them exists
yet; what distribution does in the meantime is ADR-0037, still proposed.

**`apps/macOS` is deprecated and verified by nothing.** No build, test, screenshot or render. A
Swift change says in the PR body that it was checked by hand, or not at all.

**macOS runners are free** on public repos, `argo` included (#1758): billed is $0, and the "99%
of the Actions spend" figure still quoted in older notes read the gross column. Never repeat it.
The real limits: 5 concurrent macOS jobs on GitHub Free, and no secrets on a fork PR.

Where each gate fails open, and what none of them proves: `docs/agents/quality-gates.md`.

## Landing

**Pushing a work branch and opening the PR are `/ship`'s step** (#1669), and an agent invokes it
as readily as the user types it. Every other run therefore ends at the reviewed diff, committed
on its branch; the review is `/ship`'s precondition, never its job. A `PreToolUse` hook denies
both commands and cannot tell which skill is running, so `/ship` claims the exemption by
prefixing its own commands with `ARGO_SHIP=1`.

**What leaves the base says so in a trailer**, one line in the commit that does it:
`Removes-test: <name>`, `Removes-file: <path>`, `Reverts-file: <path>` (or `*`). Nothing enforces
it; a reviewer is the check. Why a green suite cannot be:
`docs/agents/landing.md`.

**Merging is the human's** (#1577). Nothing here does it for them.

## Session isolation

**Every** change runs in a worktree under `.claude/worktrees/`, never in the shared main
checkout, a doc or config fix as much as a ticket build. From the repo root, unprompted:

```bash
git worktree add -b 'argo/#<N>-<slug>' .claude/worktrees/ticket-<N>-<slug>
```

then `EnterWorktree { path: ".claude/worktrees/ticket-<N>-<slug>" }`, or `cd` into it elsewhere.
**`EnterWorktree` creates no tree here: every call without a `path` is refused.** It names the
branch `worktree-<name>` and its `name` cannot hold a `#`, so no tree it creates reaches
`argo/#<N>-<slug>` and `/ship` cannot write `Closes #<N>` off one (#1684).

Only read-only work may stay in the main checkout, and only while it stays read-only. A write
through `Bash` counts as a change, and so does a commit: the guard reads both, and a deliberate
main-checkout commit says so with an `ARGO_MAIN_COMMIT=1` prefix (#1911). Naming, resuming, recovery and the
sub-agent rule: `docs/agents/worktrees.md`.

## Subagents

**A subagent's model is a decision per dispatch**, never inherited from this session, and a
fan-out pays it once per agent. **The dispatching session's own model is the ceiling**: a
subagent never runs a stronger model than the session that dispatches it, only the same model or
a cheaper one the task can hold. For example, Sol can dispatch Sol or a cheaper model, but it
cannot dispatch Astra. This keeps a cheap parent from turning an overestimated task into an
expensive fan-out. Name the model and the reason when you report the dispatch.

## Cross-CLI guardrail hooks

`hooks.json` (repo root) is the neutral SSOT for the four cross-CLI hooks, projected per-harness.
**Edit `hooks.json`, then run `bun run hooks:sync`**, which regenerates `.claude/settings.json`
and `.codex/hooks.json`; never hand-edit those blocks. The hooks carry no convention of their own:
this repo's live in the same file, under `worktreeGuard` (`roots`, `dir`, `branchPrefix`,
`docs`, `publishBranches`) and `worktreeGc.artifactPaths`. **Unset `branchPrefix` and the guard
stops judging branch names at all**, so an edit that empties it silently retires the naming
rule. `publishBranches` is the other side of it: a namespace listed there joins to no ticket, so
the naming guard and the push guard both let it through.

## Skill bundle

`skills-lock.json` is the bundle manifest and this repo's install record. **`skills add` only
adds**, so renaming or deleting a skill means deleting the installed copy by hand, and editing
one of Argo's own skills needs a push to `main` before a reinstall sees it. **The install is
interactive and a `--yes` add leaves Claude Code with nothing**: the exact commands, the question
that trap turns on, and the add/sweep workflow are `packages/argo-skills/README.md`.

## Design work

**A design is a ticket and a throwaway branch, and neither outlives the screen.** The
measurements, the frozen component names and the state renders are the body of the **design
ticket**; its explorable page is the only content of `design/#<N>-<screen>`, a branch named for
that ticket and reaped by `bun run worktrees:gc` once it closes. **Nothing lands on `main`**, so
there is no third copy to drift from the other two, and a ticket whose branch is gone is still
the whole spec.

A UI ticket whose screen has a design ticket is built with `design-to-code`.

`docs/design-stack.md` is the stack: the token contract, the `docs/design/` kit, where components
live, and the render commands. Every design skill reads it rather than guessing a framework.

**`docs/designs/` is a closed archive.** Everything in it is for `apps/macOS`, and nothing new
goes there.

## Visual verification

**A component is reviewed in Storybook, and a screen is reviewed by running a render command.**
Vercel owns Storybook preview deployments. Its project configuration and credentials stay outside
this repository. When a preview finishes, `storybook-links.yml` writes every story that renders a
file the PR changed, linked to that commit's preview, between the `storybook-links` markers in the
PR body (#1953):
that section is CI's, and the rest of the body is the author's. The local commands are in
`docs/design-stack.md` and `apps/desktop/README.md`.

**Every capture is disposable**: a temp dir, looked at, deleted. No gate takes a screenshot and no
ref holds one, because a PNG in a git object carries no version.
`docs/agents/visual-verification.md` describes `apps/macOS` commands that no longer exist.

One rule outlives the tooling: **an e2e run holds the real keyboard and mouse for its whole
length, so say so and wait before starting one.** The desktop render commands do not: every key
and click they send goes into the renderer over the debugging protocol.

## House rules

What no linter checks and a model does not do unprompted. Every cap, escape-hatch ban and
formatting rule is a build failure in `biome.jsonc`, so none is restated here; when a gate
fires, fix the code or ratchet the exemption where the config keeps it, never inline
(`docs/agents/quality-gates.md`).

### Code

- **Ground external calls.** Every call into an API you don't own is written against a source
  opened this session: the installed dependency's own declarations, an existing call site, or
  the current docs. If it can't be grounded, say so instead of shipping it.
- **Names are words.** `percentage` not `pct`, `context` not `ctx`, `repository` not `repo`,
  user-visible labels included. Exceptions: an acronym that is the domain's own name (`URL`,
  `ID`) and a name the platform fixes.
- **Branch on a closed set with the exhaustive construct**, and reserve chained `if` for open
  conditions. When the discriminant only picks a value, a lookup keyed by it beats both.
- **Validate at the boundary.** Data from outside is parsed into a known shape at the edge,
  once; a cast or an all-optional model standing in for a check is a bug moved inward.
- **One source of truth.** A literal in two call sites is extracted before the second paste.
  A new variant of an existing kind is one new file plus one registration line.
- **Group by domain, never by kind.** `Tickets/`, not `Helpers/` or `Utils/`; a helper is born
  beside its only caller and hoists on the third.
- **Tokens by name.** Every colour, spacing, radius, duration and type size is a named token
  from the design package, never an inline literal or hex.
- **Only what's needed.** No config knob, layer or hook for a need that doesn't exist yet.
  Delete dead code on sight.

### Comments

An ordinary comment is one line, for `//`, `///` and `#` alike; nothing here is published,
so a doc marker buys no room. Keep a fact a future edit could falsify (a measured number, a
framework behaviour, a defence of code that looks wrong) at whatever length it needs. Cut an
argument, a rejected alternative, a WHAT-restatement, a tombstone, or the story of how a
constraint got here; a bare `#412` on the constraint line is enough.

### Tests

- **Assert what happened, never that a function was called.** A refactor that preserves
  behaviour leaves the suite green.
- **Mock only what you don't control and can't afford live**: a paid API, a clock, a network
  CI can't reach. Everything you own runs for real.
- **Name the claim in the domain's words** (`rejects an expired token`), one behaviour per
  test, and the same behaviour over several inputs is one parameterised case.
- **Each test builds its own state** and passes alone, in any order, in parallel.

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context. The
global hook auto-wraps `git`, `grep`, `gh`, `ls` and `find`, and `.rtk/filters.toml` covers this
repo's noisy entrypoints. Two silent traps: rtk reads that file from the working directory only,
so a new run location needs a `.rtk` symlink back to the root, and the filters are inert until
`rtk trust --yes`, re-run per checkout and after any edit. A review's input diff must be
complete: `RTK_DISABLED=1 git diff`. Why: `docs/agents/rtk-filters.md`.
