# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. The cockpit is mid-migration:
`apps/macOS` is the deprecated Swift app, kept for reference and verified by nothing, and
`apps/desktop` is the Electron replacement being built on #1730. Read by both Claude Code and Codex.

## Agent skills

- **Issue tracker** — Issues and PRDs live in GitHub Issues on `milad-alizadeh/argo`, via the
  `gh` CLI. A screenshot goes in the issue body, and in the PR body when a screen
  changes — when there is a screen to shoot, which right now there is not (#1758).
  See `docs/agents/issue-tracker.md`.
- **Triage labels** — five canonical triage roles, each label string equal to its name. Every
  issue is labelled in the `gh issue create` call, never afterwards. See
  `docs/agents/triage-labels.md`.
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

**No session pushes a work branch or opens a pull request. `/ship` does both, and `/ship` is a
separate invocation the caller makes** (#1648, #1669). A run ends at the reviewed diff, committed
on its branch; what becomes of that branch is the human's next keystroke, not the run's last step.
`/ship` carries the close-out nothing else runs — the sweep for `.only` and debug prints, the
screenshots if the diff has a screen, the review findings written into the body
— and it carries what it cannot tick rather than stopping, an unreviewed diff included. So a run
that opens its own PR does not route around a refusal; it opens one having done none of that.

Three files push something that is not a work branch, and they are the only exceptions:

- **The evidence ref**, which publishes screenshots for a body `gh` cannot attach a file to. The
  commit it pushes sits on no branch, so it never merges: `pixel-review/PR-EVIDENCE.md`, and the
  same recipe in `setup-argo-skills`, which appends it to a consumer's doc.
- **The design-branch delete** in `design-to-code` step 6, which drops `design/<screen>` once the
  screen has shipped.

The allowlist is `ALLOWED` in `scripts/pr-ownership.mjs`, per command, and
`scripts/pr-ownership.test.mjs` fails when any other skill file names one of them.

## Rules

House engineering rules live in `rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code** — `house.md`: what no linter checks and a model does not do unprompted. Its
  reference to `.swiftlint.yml` is stale; nothing runs SwiftLint. The
  arithmetic (length, complexity, arity, escape hatches) is a gate, not prose: `biome.jsonc` is
  where those numbers live.
- **Swift and the cockpit** (`apps/macOS`) — `swift.md` still describes the deprecated Swift app.
  Read it only to understand behaviour being ported to `apps/desktop`; nothing enforces it now.

### Module boundaries

`apps/macOS` was layered by its SPM target graph, and the compiler refused an undeclared import.
**Nothing compiles it now** (#1758), so even that enforcement is gone and the section below is a
record of the design rather than a live rule. The shell gate
that used to check the rest — nine edges in `scripts/swift-boundaries.sh` — is gone, so what it
carried is now convention, held by review rather than by exit code: the headless modules stay
clear of SwiftUI and AppKit, `ArgoUI` does not import the dev-tool targets beside it, a design
constant is declared in `ArgoDesign` and named once, and no view asks SwiftUI how tall a row is.
ADR-0022, ADR-0027 and ADR-0030 hold the reasoning behind most of these;
`apps/macOS/README.md` holds the dev-tool-target one.

### Quality gates

Every rule in `bun run quality` is an **error, never a warning**, and the caps live in
`biome.jsonc`, not in prose. When a gate fires, fix it or ratchet it in the config: **never
suppress inline, never raise a global cap.** Both configs fail open when commented, so no gate is
proved by exit code alone.

**CI is the only gate.** `.github/workflows/ci.yml` runs biome, the
duplication gate and `bun run test:hooks` on Linux, and a second job on `macos-26` that packages
`apps/desktop` for arm64, asserts the packaged `node-pty`, and runs the shipped app's acceptance
harness (#1769). That job runs only when the pull request touches `apps/desktop`, the root
manifest, the lockfile or `.github/`, and its filter fails CLOSED: an unreadable base ref runs the
job rather than skipping it. There is no push-time gate: `.husky/pre-push` is gone,
and so are `scripts/swift-gate.sh` and the cache, build-lock and metrics machinery around it. No
`ARGO_SKIP_SWIFT_GATE`, no `ARGO_GATE_CALLER`, no `bun run gate:report`, no `bun run warm`. A
session runs `bun run quality` and `bun run test:hooks` on its final tree and that is the whole
bar. `quality` is biome plus the duplication gate; running only biome leaves a duplication breach
to be found by CI.

**`apps/macOS` is deprecated and verified by nothing.** Its source is still on disk, but its
build, test, screenshot, specimen and release scripts are deleted and it is no longer a workspace
package. Nothing compiles it, nothing tests it, and `/pixel-review` cannot render it. Do not open
Swift work expecting a gate to catch you; if a Swift change is genuinely needed, say plainly in the
PR body that it was checked by hand or not at all.

**The cost claim that shaped all of this was wrong, and the correction is load-bearing** (#1758).
#1340 removed a `macos-26` CI job because it "billed about 99% of this repo's Actions spend". That
figure is the **gross** column of the billing page. The **billed** column is $0, every day, on the
`Actions macOS 3-core` SKU, because standard GitHub-hosted runners are free and unlimited on public
repositories and `argo` is public. Never quote the old number. When `apps/desktop` needs CI, a
macOS job is affordable; design around the two real limits instead, 5 concurrent macOS jobs on
GitHub Free and no secrets on a fork PR.

### Landing

**A lane never rebases to open a PR.** It opens its PR on the base it was cut from. This was
written when a rebase meant paying the Swift gate again, lanes multiplied by merges, over a repo
taking about ninety commits a day (#1377). The gate is gone, so the cost argument is gone with it,
but the rule stands on its own: being behind the base is the normal state of a branch, not a defect
in it.

**Merging is the human's, and nothing here does it for them** (#1577). `scripts/land.sh` used to
rebase, gate and merge in one pass, and no step in it asked a person; it is gone. So the rebase
onto the current default branch has no automatic home either — the open question in #1577 is
where it goes.

**What leaves the base has to say so.** `scripts/kept-the-tests.sh` and
`scripts/undoes-the-base.sh` read a merged tree against the base and refuse one that drops a test
the base has (`Removes-test: <name>`), deletes a file it has (`Removes-file: <path>`), or holds
content the base has moved past (`Reverts-file: <path>`, or `*` for the whole change). One
trailer line, in the commit that does it. A rebase that takes the pre-fix side of a file deletes
the test that guarded the fix, and every suite is green afterwards (#1558). `land.sh` was their
caller and is gone, so run them by hand before merging:
`sh scripts/kept-the-tests.sh . origin/main HEAD`.

Two lanes never own the same file, whatever the vocabulary split says. The arithmetic, the
measurements, and which of them the retired gate invalidates: `docs/agents/landing.md`.

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

A `/command` the user typed is **already loaded**; follow it directly and never call the `Skill`
tool for it. `skills-lock.json` is the bundle manifest and this repo's install record; `bun run
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

**Nothing takes this route today** (#1758). Every design in `docs/designs/` is for `apps/macOS`,
which is deprecated and built by no ticket, and `pixel-review` has no app to render: the scripts
it drove are deleted. The route is written down for `apps/desktop`, which will need its own
designs and its own renderer.

**The design `.md` is on `main`; its explorable `.html` never is** (#1526). The page lives on the
branch the `.md`'s front matter names — `explorable: design/<screen>` — and is read without a
checkout with `git show design/<screen>:docs/designs/<screen>.html`. `explorable: gone` means the
screen shipped and the branch was deleted, and the `.md` plus its state renders are then the whole
spec; `bun run worktrees:gc` does the deleting once the screen's epic closes. So a `docs/designs/`
listing showing no page is the rule working, not a design that is missing.

## Visual verification

**There is nothing to render right now** (#1758). `apps/macOS` lost its screenshot, specimen and
e2e scripts with the rest of its tooling, so `/pixel-review` has no app to drive and
`docs/agents/visual-verification.md` describes commands that no longer exist. `apps/desktop` will
need its own rendering route, and choosing it is open work.

Two rules that outlive the tooling and apply to whatever replaces it. **An e2e run holds the real
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
