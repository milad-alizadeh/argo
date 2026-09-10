# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. The cockpit is mid-migration:
`apps/macOS` is the deprecated Swift app, kept for reference, and `apps/desktop` is the Electron
replacement being built on #1730. Read by both Claude Code and Codex.

Everything here is a fact about this repository. Process belongs to the skill that owns it.

## Where things are written down

- **Issues, PRDs and triage labels** — GitHub Issues on `milad-alizadeh/argo`, via `gh`. A
  screenshot reaches a body only when a person drags it in; an agent writes a Storybook link
  instead, and keeps its own captures in a temp dir. Every issue is
  labelled in the `gh issue create` call and never afterwards, and each label string equals its
  role name, so a vendored skill naming a role names our label. `docs/agents/issue-tracker.md`.
  Before triage, read `docs/agents/triage-labels.md`.
- **House engineering rules** — `rules/`. **Nothing loads these for you.** Before your first
  edit, read the one whose `paths:` frontmatter matches what you are about to touch: `house.md`
  matches everything, `desktop.md` only `apps/desktop/**`, `swift.md` only
  `apps/macOS/**/*.swift`. The arithmetic behind them is `biome.jsonc`, not prose.
- **Domain model** — `docs/domain/`, indexed by `CONTEXT.md`.
  Before domain exploration, read `docs/agents/domain.md`. Read the one
  section you need before naming or changing a term, and use its words rather than a synonym.
  Code comments cite it as `CONTEXT.md L1 · Binding`. Change a term only after
  `docs/domain/rationale.md`. A concept the model does not name is a signal: either the name is
  invented and wants reconsidering, or the gap is real and wants recording.
- **Decisions** — `docs/adr/`. Nothing loads these either. Read the ones covering an area before
  changing it, and when your work contradicts one, **say so rather than quietly overriding it**:
  *Contradicts ADR-0026, but worth reopening because…*
- Load `/writing-for-agents` immediately before you draft or materially edit instructions for
  agents. This includes `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, and similar files. Ordinary code edits
  do not trigger it.
- Load `/simple-english` immediately before you draft text for a person. This includes issue titles
  and bodies, comments, close messages, PR titles and bodies, user questions, and grilling rounds.
  Also load it for agent-facing Markdown that people will read. Ordinary implementation work and
  progress commentary do not trigger it. Apply it while you draft, not as cleanup.

## Gates

Before code review, read `docs/agents/code-review.md` for repository references and focused-test boundaries.

**CI is the only gate**, and there is no push-time one. `.github/workflows/ci.yml` names every
step it runs on Linux and `bun run quality` is the local subset; read the step list there, never
a copy of it. `quality` is wider than biome, so biome alone leaves a typecheck or a duplication
breach for CI. A `macos-26` job packages `apps/desktop`, asserts the packaged `node-pty` and runs
the shipped app (#1769) when the PR touches `apps/desktop`, the root manifest, the lockfile or
`.github/`.

When a gate fires, fix it or ratchet it in `biome.jsonc`: **never suppress inline, never raise a
global cap.** Both configs fail open when commented, so no gate is proved by exit code alone.

**Node is pinned to `.node-version` exactly**, and `scripts/node-version-gate.mjs` refuses any
other from the root `preinstall` and from `bun run quality:node` (#1800). After switching Node,
delete `node_modules` and reinstall: `node-pty` is a native addon bound to the ABI. A workflow
reaches the pin through `node-version-file: .node-version`, and nothing checks that it does, so a
literal version hard-coded into one is caught by review or not at all.

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
through `Bash` counts as a change; the guard reads those too. Naming, resuming, recovery and the
sub-agent rule: `docs/agents/worktrees.md`.

## Subagents

**A subagent's model is a decision per dispatch**, never inherited from this session, and a
fan-out pays it once per agent. **Gathering** — search the tree, read files, report what they
say — is recall, and takes the cheapest model that can hold the task. **Judging** — review a
diff, weigh two designs, trace a bug through code that lies about itself — is inference, and
takes the strongest available, because a cheap model here returns a confident, shallower answer
and nothing in the output says so. A job that is both splits in two. Name the model and the
reason when you report the dispatch.

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

**A component is reviewed on the Storybook site, and a screen is reviewed by running a render
command.** The site is built from `main` by `.github/workflows/storybook-pages.yml` and served at
`https://milad-alizadeh.github.io/argo/`; `ci.yml`'s `storybook` job rebuilds it on every pull
request as the gate and comments the stories that pull request touches (#1910). The render
commands are `docs/design-stack.md`'s last rows, and `apps/desktop/README.md` says what each
writes.

**Every capture is disposable**: a temp dir, looked at, deleted. No gate takes a screenshot and no
ref holds one, because a PNG in a git object carries no version.
`docs/agents/visual-verification.md` describes `apps/macOS` commands that no longer exist.

One rule outlives the tooling: **an e2e run holds the real keyboard and mouse for its whole
length, so say so and wait before starting one.** The desktop render commands do not: every key
and click they send goes into the renderer over the debugging protocol.

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context. The
global hook auto-wraps `git`, `grep`, `gh`, `ls` and `find`, and `.rtk/filters.toml` covers this
repo's noisy entrypoints. Two silent traps: rtk reads that file from the working directory only,
so a new run location needs a `.rtk` symlink back to the root, and the filters are inert until
`rtk trust --yes`, re-run per checkout and after any edit. A review's input diff must be
complete: `RTK_DISABLED=1 git diff`. Why: `docs/agents/rtk-filters.md`.
