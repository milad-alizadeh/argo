# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. The cockpit is mid-migration:
`apps/macOS` is the deprecated Swift app, kept for reference, and `apps/desktop` is the Electron
replacement being built on #1730. Read by both Claude Code and Codex.

## Agent skills

- **Issue tracker** — Issues and PRDs live in GitHub Issues on `milad-alizadeh/argo`, via the
  `gh` CLI. A screenshot goes in the issue body, and in the PR body when a screen changes.
  See `docs/agents/issue-tracker.md`.
- **Triage labels** — five canonical triage roles, each label string equal to its name. Every
  issue is labelled in the `gh issue create` call, never afterwards. See
  `docs/agents/triage-labels.md`.
- **Writing for agents** — `/writing-for-agents` before editing any file an agent reads. Its
  own description covers skills, `AGENTS.md` and `CLAUDE.md`; here that extends to `rules/` and
  `docs/agents/`.
- **Domain docs** — single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See
  `docs/agents/domain.md`. The vocabulary is inlined under **Domain model** below. `CONTEXT.md`
  is now an index and the sections are files under `docs/domain/`, so read the one section you
  need rather than the whole model. No harness auto-loads any of it. The reasoning *behind* each
  term lives in `docs/domain/rationale.md` — read that only when changing a term.

## Task tracking

Maintain a live to-do list for any task with **three or more distinct steps**, edits across
**multiple files**, or **a plan the user approved**. Claude Code: `TaskCreate` one call per item,
then `TaskUpdate` for each status change. Codex: `update_plan`.

`TaskCreate` and `TaskUpdate` are **deferred** tools in Claude Code: they cannot be called until
their schemas are loaded, so a qualifying task starts with one
`ToolSearch("select:TaskCreate,TaskUpdate")` before the first edit. Load them once, at the top of
the task; a session that waits until it wants the list writes no list at all.

- Write the list **before the first edit**, not as a retrospective summary.
- Exactly **one** item `in_progress` at a time; mark it `completed` the moment it is done, not
  in a batch at the end.
- Work the items **in the order the list gives them**, and mark an item `in_progress` **before**
  starting it. A list that jumps from item 1 to item 3 is a list nobody can read progress from.
  If the real order turns out to be different, reorder the list rather than skip an item.
- One item = one verifiable outcome. "Fix the bug" is a task; "read the file" is not.
- Keep single-step edits, lookups, and conversational turns off the list — a one-item list is
  noise, and a list nobody needed teaches the next session to ignore lists.
- **Split the verification tail into one item each**: the lint gate, the hook suites, the code
  review, the review fixes. Only the ones the change actually needs, but never two of them folded
  together.
- **No item holds more than one gate, suite or review.** A subject that comma-lists what it covers
  — "Verify: gates, render, pixel-review, code-review", "Full suites, quality gates, review,
  commit" — is the shape to reject (#1419).
- **The list runs to the reviewed diff**, so the last item completes when the work is proved, not
  when it is committed. A full bar is otherwise not a finished session (#1419).
- **No item of yours pushes or opens a PR**: **Pushing and pull requests** below (#1648).

## Pushing and pull requests

**`/ship` pushes the branch and opens the PR, and the caller invokes it** (#1648). A run ends at
the reviewed diff, committed on its branch. `/ship` carries the close-out nothing else runs — the
sweep for `.only` and debug prints, the rebase onto the current base, the review findings written
into the body — and it carries what it cannot tick rather than stopping.

## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code** — `house.md`: what no linter checks and a model does not do unprompted. The
  arithmetic (length, complexity, arity, escape hatches) lives in `biome.jsonc`.
- **Swift** (`apps/macOS`) — `swift.md`, read only for behaviour being ported to `apps/desktop`.

### Quality gates

Every rule in `bun run quality` is an **error, never a warning**, and the caps live in
`biome.jsonc`, not in prose. When a gate fires, fix it or ratchet it in the config: **never
suppress inline, never raise a global cap.** Both configs fail open when commented, so no gate is
proved by exit code alone.

**CI is the only gate**, and there is no push-time one. `.github/workflows/ci.yml` runs biome, the
duplication gate and `bun run test:hooks` on Linux; a `macos-26` job packages `apps/desktop`,
asserts the packaged `node-pty` and runs the shipped app (#1769) when the PR touches
`apps/desktop`, the root manifest, the lockfile or `.github/`. `quality` is biome **plus** the
duplication gate; biome alone leaves a duplication breach for CI.

**Node is pinned to `.node-version` exactly**, and `scripts/node-version-gate.mjs` refuses any
other from the root `preinstall` and from `bun run quality:node` (#1800). After switching Node,
delete `node_modules` and reinstall — `node-pty` is a native addon bound to the ABI. A workflow or
composite action reads `node-version-file: .node-version`; `scripts/node-version-source.test.mjs`
fails on a literal version anywhere.

**`apps/macOS` is deprecated and verified by nothing** — no build, test, screenshot or render.
A Swift change says in the PR body that it was checked by hand, or not at all.

**macOS runners are free** on public repos, `argo` included (#1758). The "99% of the Actions
spend" figure that removed a `macos-26` job read the gross column; billed is $0. Never quote it.
The real limits: 5 concurrent macOS jobs on GitHub Free, and no secrets on a fork PR.

### Landing

**Rebase onto the current base before opening a PR**, and gate it there. `/ship` owns the step.
An out-of-date PR is reviewed against a tree nobody has and conflicts in the human's hands.

**Merging is the human's** (#1577). Nothing here does it for them.

**What leaves the base says so in a trailer**, one line in the commit that does it:
`Removes-test: <name>`, `Removes-file: <path>`, `Reverts-file: <path>` (or `*`).
`scripts/kept-the-tests.sh` and `scripts/undoes-the-base.sh` refuse an untrailered one, and
nothing calls them now — run them before merging:
`sh scripts/kept-the-tests.sh . origin/main HEAD`.

Why each of these, and the arithmetic behind them: `docs/agents/landing.md`.

## Session isolation

**Every** change runs in a worktree under `.claude/worktrees/`, never in the shared main
checkout — a doc or config fix as much as a ticket build. From the repo root, unprompted, create
the tree with git and then enter it by path:

```bash
git worktree add -b 'argo/#<N>-<slug>' .claude/worktrees/ticket-<N>-<slug>
```

then `EnterWorktree { path: ".claude/worktrees/ticket-<N>-<slug>" }` in Claude Code, or `cd` into
it in another harness. **`EnterWorktree` creates no tree here: every call without a `path` is
refused**, a `name` you chose and the random one it generates when you pass none alike. It names
the branch `worktree-<name>` and its `name` cannot hold a `#`, so no tree it creates reaches
`argo/#<N>-<slug>` and `/ship` cannot write `Closes #<N>` off one (#1684).

Only read-only work (review, triage, Q&A) may stay in the main checkout, and only while it stays
read-only. A write through `Bash` — `cat > file`, `sed -i`, `cp` — counts as a change; the guard
reads those too. Naming, resuming, recovery, the sub-agent rule and `bun run worktrees:gc`:
`docs/agents/worktrees.md`.

## Cross-CLI guardrail hooks

`hooks.json` (repo root) is the neutral SSOT for the four cross-CLI hooks — three guardrails
(worktree edit guard, worktree naming guard, worktree-gc) and the to-do-list nudge, which only
ever adds context and can never block — projected per-harness. **Edit
`hooks.json`, then run `bun run hooks:sync`** — it regenerates `.claude/settings.json` and
`.codex/hooks.json`; never hand-edit those blocks. Consumers opt in via `scaffold.mjs --hooks`,
and narrow the edit guard, whose default scope is the whole repository, with
`worktreeGuard.roots` in the same file.

A script named in `hooks.json` must also be in `MANAGED_MARKERS` (`hooks-sync.mjs`) or the
projection grows a duplicate on every run. `test:hooks` fails when it isn't.

## Skill bundle

A `/command` the user typed arrives either as its **body** or as **the name alone**, and which one
is visible decides the move: follow the body when it is there, call the `Skill` tool when only the
name arrived. `skills-lock.json` is the bundle manifest and this repo's install record; `bun run
scaffold` installs from it. `skills add` only adds, so renaming or deleting a skill means deleting
the installed copy by hand, and editing one of Argo's own skills needs a push to `main` before a
reinstall sees it. Add/sweep workflow: `packages/argo-skills/README.md`.

A `/command` that "does nothing" is usually one whose turns end in a question: from the composer
that is indistinguishable from one that never ran, so count them before theorising —
`scripts/slash-outcomes.mjs` (#1208).

## Code review

An implement run reviews its own diff, and the review is the last thing it does. `/ship` does not
run one and does not refuse a diff that never had one — it writes "unreviewed" in the PR body and
ships anyway, so the review is the caller's step or it does not happen. The review only works in a
**fresh
context that never saw the author's reasoning**. Claude Code: `code-review` fans out parallel
axis sub-agents via the `Agent` tool. Other harnesses: run the review from a separate fresh
session over the diff.

If no independent fresh context is reachable, **stop and report that** — do not run the axes
yourself and present it as a review. Claude Code trap: agents spawned inside a `Workflow` have
no `Agent` tool, so run implement directly, not nested in a Workflow.

**A review agent is read-only** (#1711). No axis runs a build, a full suite or `bun run quality`:
a review changes the tree, so anything the reviewer verifies is bytes nobody ships. One focused
test is the only exception, and only when the reviewer states the uncertainty it resolves and names
its package. A complete axis runs a second time only for a **P0 or P1 fix that
changes behaviour that axis covers** — everything else gets one focused review of the changed
hunks. The brief every axis prompt carries, and the measurements behind both rules:
`docs/agents/code-review.md`.

## Design work

A UI ticket whose screen has a design in `docs/designs/` is built with **`design-to-code`**,
not `implement`. The design carries measurements the ticket's prose does not, so a screen built
without it drifts from what was agreed and nothing downstream can tell that drift from a bug.

The route in full — `/prototype` explores variants, `prototype-to-design` approves one and lands
it with a render, `design-to-code` builds it per ticket, `pixel-review` judges the pixels. This
is a **repo rule, not a skill description**: which tickets take the design route depends on what
is in `docs/designs/`, which no portable skill can know.

**Nothing takes this route today** (#1758): every design in `docs/designs/` is for `apps/macOS`.
It is written down for `apps/desktop`, which will need its own designs and its own renderer.

**The design `.md` is on `main`; its explorable `.html` never is** (#1526). The page lives on the
branch the `.md`'s front matter names — `explorable: design/<screen>` — and is read without a
checkout with `git show design/<screen>:docs/designs/<screen>.html`. `explorable: gone` means the
screen shipped and the branch was deleted, and the `.md` plus its state renders are then the whole
spec; `bun run worktrees:gc` does the deleting once the screen's epic closes. So a `docs/designs/`
listing showing no page is the rule working, not a design that is missing.

## Visual verification

**There is nothing to render right now** (#1758), and
`docs/agents/visual-verification.md` describes commands that no longer exist. Choosing
`apps/desktop`'s rendering route is open work.

Two rules outlive the tooling and apply to whatever replaces it. **An e2e run holds the real
keyboard and mouse for its whole length: say so and wait before starting one.** **Never hand-roll a
load generator; use `sh scripts/load-burst.sh <workers> <seconds>`**, which burns CPU cores and
makes no Sessions, and stop it with the `--reap <token>` it prints, never a bare `pkill`.

## Tooling (RTK)

**Always prefix shell commands with `rtk`** so output is filtered before it reaches context; the
global hook auto-wraps `git`, `grep`, `gh`, `ls`, `find`, and `.rtk/filters.toml` covers this
repo's noisy entrypoints. Two silent traps: rtk reads that file from the working directory only,
so a new run location needs a `.rtk` symlink back to the root; and the filters are inert until
`rtk trust --yes`, re-run per checkout and after any edit. A review's input diff must be
complete: `RTK_DISABLED=1 git diff`. Why: `docs/agents/rtk-filters.md`.

## Domain model

The model lives under `docs/domain/`, one file per section, indexed by `CONTEXT.md` at the repo
root. Nothing loads it. Read the section you need before naming, rendering or changing a term, and
use its words rather than a synonym. Code comments cite it by section name, like
`CONTEXT.md L1 · Binding`, and the index maps every name to its file.
