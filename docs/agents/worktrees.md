# Worktree mechanics

Implementation work runs in a git worktree under `.claude/worktrees/`, never the shared main
checkout — multiple agent sessions run concurrently, and isolating each unit of work on its own
tree and branch keeps them from clobbering each other's files. A `PreToolUse` hook
(`scripts/worktree-guard.mjs`) enforces it, blocking agent `Edit`/`Write` to `apps/**` or
`packages/**` from outside a worktree, and a second one (`scripts/worktree-name-guard.mjs`)
enforces the naming below at creation. This file is the *how* they cite — naming, resuming an
interrupted worktree, recovering a deleted one. It applies to all implementation work, not just
`/implement` runs, and is self-contained so it stands alone when the hooks copy it into a
consumer project.

## Naming — one deterministic format

Both names for a unit of work are derived from the ticket number `<N>` and a kebab-case
`<slug>`. They are never improvised, so any session (or `/ship`, or the resume check below) can
reconstruct them from `<N>` alone:

| thing | format | example (ticket #30, "session screen") |
| --- | --- | --- |
| worktree directory | `ticket-<N>-<slug>` | `.claude/worktrees/ticket-30-session-screen` |
| branch | `argo/#<N>-<slug>` | `argo/#30-session-screen` |

The two share the same `<N>-<slug>` stem and differ only in prefix, because `EnterWorktree`'s
`name` param forbids `#` and `/`: the branch namespaces the stem as `argo/#<N>-<slug>`, the
directory uses a plain `ticket-<N>-<slug>`. Pick the `<slug>` once from the ticket title; keep it
identical across both. The `#<N>` in the branch is load-bearing twice over: whatever opens the PR
parses it to write `Closes #<N>`, and the Argo cockpit parses it to name the Session's row after
the ticket (#745). A branch without it breaks the PR→ticket link and leaves the row reading
`/implement <N>`.

For work with no ticket, keep the shape but drop the number: worktree `ticket-<slug>`, branch
`argo/<slug>`. Work with no ticket may start — refusing it would push spikes back into the
shared main checkout, which is the worse failure. What may not start is an *undeclared* one:
the numberless slug may not itself begin with a number, because `argo/901-naming` is a dropped
`#` and nothing downstream can tell it from a deliberate statement that no ticket exists.

### The names are enforced, not merely documented

`scripts/worktree-name-guard.mjs` is a `PreToolUse` hook on `Bash` and `EnterWorktree`. It
refuses:

- a worktree directory that is not `.claude/worktrees/ticket-<N>-<slug>` — from `git worktree
  add` or an `EnterWorktree` `name:`;
- an explicit `-b` branch that is not `argo/#<N>-<slug>`;
- a directory and branch that do not share one `<N>-<slug>` stem — each name can be well-formed
  alone and still not name the same work;
- `git branch -m`, `git switch -c` or `git checkout -b` inside a worktree, onto a branch that is
  not `argo/#<N>-<slug>`.

Every refusal states the correct shape, so the fix is in the message rather than a lookup.

It fires **only at creation**, the one moment a name is still free. Editing inside an existing
tree is not guarded here, and neither is `git worktree add <path> <branch>` (the recovery below),
`EnterWorktree` with `path:` (re-entering), or a two-name `git branch -m <old> <new>`, which
provably targets a branch other than the one in hand. A tree already named off-convention
therefore drains rather than breaks — renaming a branch under a running agent is worse than the
misnaming. A path the hook cannot resolve (one still holding a `$`) is allowed for the same
reason: guessing at an expansion would deny a name that may well be correct.

What it cannot enforce is the `git branch -m` in **Entering** below actually happening. The
directory carries the `<N>` either way, so the cockpit row survives; `Closes #<N>` does not.

## Entering

Enter a worktree first, unprompted, on the ticket branch:

- **Claude Code:** `EnterWorktree` with `name: "ticket-<N>-<slug>"`. It puts the worktree on a
  branch named `worktree-<name>`, which carries no `#<N>`, so the rename is not optional:
  `git branch -m argo/#<N>-<slug>`, in the new worktree, before the first commit.
- **Other harnesses:** `git worktree add -b argo/#<N>-<slug> .claude/worktrees/ticket-<N>-<slug>`.

Then **`rtk trust --yes`** in the new worktree. rtk trusts `.rtk/filters.toml` by path, so a
fresh worktree is untrusted and its filters are inert — silently, with no warning of any kind
(`docs/agents/rtk-filters.md`).

## Resuming interrupted work — `/implement #<N>` is idempotent

Because the names are a pure function of `<N>`, re-running `/implement #<N>` must land in the
**same** worktree, not a second one. **Before creating anything**, check for existing work
anchored on the number:

```bash
git worktree list | grep "ticket-<N>-"                  # existing worktree (branch renamed or not)
git branch --list "argo/#<N>-*" "ticket-<N>-*"          # worktree gone, branch survives
```

Match on `<N>`, not the full slug — a slug typed slightly differently must not fork a second
tree. The branch check globs **both** prefixes on purpose: a worktree interrupted before the
`git branch -m` rename (see **Entering**) still sits on `ticket-<N>-<slug>`, so matching only
`argo/#<N>-*` would miss it. If a match exists, re-enter it (Claude Code: `EnterWorktree` with
`path:` to the existing directory; other harnesses: `cd` into it) and re-derive progress from
durable state — the ticket, `git log` / `status` / `diff`, and a test run — not from the previous
conversation. Only when no `#<N>` worktree or branch exists do you create a fresh one per
**Entering** above.

To make an interruption safe, commit WIP and push the ticket branch before stopping: an unpushed
worktree is the only copy of the work.

## Recovering a deleted worktree

If the worktree is gone but the branch was pushed, recreate it from the branch:

```bash
git worktree add .claude/worktrees/ticket-<N>-<slug> argo/#<N>-<slug>
```

If the branch was never pushed and the worktree is gone, the work is lost — which is why the
push-before-stopping step above is not optional.

## Sub-agents stay in the parent's worktree

A dispatched sub-agent **inherits its parent's worktree and stays there by default** — it must
not spin up its own (Claude Code: don't pass `isolation: "worktree"` to the `Agent` tool).
Nesting worktrees per sub-agent just proliferates them and splits state across trees — separate
checkouts, separate branches, and confusion over which one a dev server is serving. The parent's
worktree already provides the isolation from the shared main checkout. The **one** exception is
an explicit instruction from the parent to give a sub-agent its own worktree — a parent decision,
never something a sub-agent takes on its own.

## Reaping landed worktrees

`bun run worktrees:gc` (`scripts/worktree-gc.sh`) removes only what is provably safe: PR merged,
tree clean, nothing unpushed, and untouched for 30 minutes. Everything else is reported and left
alone. `--dry-run` reports without removing.
