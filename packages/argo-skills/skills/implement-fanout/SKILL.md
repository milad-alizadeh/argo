---
name: implement-fanout
description: Implement several INDEPENDENT tickets in parallel — each in its own git worktree via a subagent — then collect their draft PRs. Use when 2+ ready tickets have no dependency edge between them and you want throughput without sessions clobbering each other. For a single ticket or a dependency chain, use /implement instead.
---

# Implement Fanout

The parallel sibling of `/implement`. `/implement` is deliberately one-ticket-per-context — a fresh
context keeps the model sharp, and worktrees are a harness concern, not a skill concern. This skill
**keeps that principle** (each ticket still gets its own isolated, fresh context) but automates the
fan-out across *independent* tickets so you aren't opening sessions by hand.

One-at-a-time is still the default. This is the exception for a genuine batch of siblings.

## When to use vs `/implement`

- **`/implement`** — one ticket, or a dependency **chain** (#N needs #N-1). A chain has no frontier
  to parallelize; run it serially, one ticket per fresh conversation.
- **`/implement-fanout`** — **2+ ready tickets with no dependency edge between them.**

## Harness requirement

Orchestration uses Claude Code's `Workflow` + per-agent `isolation: "worktree"`. On a harness
without them (Codex, Cursor), don't emulate it — fall back to the serial loop: `/implement` one
ticket per fresh conversation, in dependency order, and say so.

## Process

### 1. Scout the frontier (inline, in the main session — cheap)

- Read the open tickets from the issue tracker (see `docs/agents/issue-tracker.md`).
- Parse each ticket's `Blocked by:` edges into a dependency DAG.
- The **frontier** = tickets that are ready-for-agent **and** have no unresolved blocker (every
  blocker already merged/closed).
- Independence here is **DAG-level only**. Two frontier tickets may still touch the same files and
  merge-conflict later; that is expected and resolved at merge time, not here.

### 2. Confirm with the user (explicit opt-in + cost)

Fan-out spawns one full implement agent per ticket — each edits, tests, self-reviews, commits, and
opens a PR — so it costs roughly N× a single ticket. Present, and get an explicit go before spawning:

- the frontier tickets you'll run (numbers + titles);
- the concurrency cap (default **2–3** at once; higher only if the user asks);
- that each opens a **draft** PR for the user to review and merge.

### 3. Fan out — one worktree-isolated agent per ticket

Run a `Workflow` that fans out the frontier, capped at the agreed concurrency:

```js
parallel(frontier.map(t => () =>
  agent(briefFor(t), { isolation: 'worktree', label: `implement:#${t.number}` })))
```

Each agent's brief is self-contained (it has its own fresh context — that's the point) and runs
this **ordered, non-skippable contract**. Every step happens *inside that agent's own worktree*, so
review and the PR are per-ticket, not shared:

1. **Implement** — read ticket #N from the tracker and build it following `/implement`: TDD at
   agreed seams, typecheck / lint / single-file tests regularly, the full suite once at the end.
2. **Verify** — the full suite (typecheck, lint, tests, build) must be green before proceeding.
3. **Code-review** — run `/code-review` on your own diff and address the findings. This runs
   **per worktree**, in the agent's fresh context — it is not optional and is not deferred to the
   human. If a finding can't be resolved, note it in the PR body rather than skipping it.
4. **Commit** to a ticket branch (`argo/#${N}-<slug>` or the repo convention).
5. **Push** that branch.
6. **Open exactly one draft PR** for this worktree — body says `Closes #N`, and lists any
   unresolved review findings from step 3. **Return the PR URL** as your result.

Do **not** merge. Do **not** touch any other ticket's files. One worktree → one branch → one draft PR.

`isolation: "worktree"` gives each agent its own working directory, index, and HEAD, so concurrent
agents can't clobber each other — the exact failure mode of running plain `/implement` in parallel
in one tree (amend landing on another session's commit, vanished stash, wrong-branch commits).

> **Independent review (optional, stronger).** Self-review in the same context can miss
> plausible-but-wrong findings. For higher assurance, make each ticket a two-stage `pipeline`:
> stage 1 implements + commits in the worktree; stage 2 is a *separate* agent that enters the same
> worktree (`agent(..., { isolation })` returns its path; a reviewer re-enters via `EnterWorktree`
> with that `path`) and runs `/code-review` with fresh eyes before the PR is opened. Costs ~2× per
> ticket; use it when the batch is high-stakes.

### 4. Collect and report

Gather the returned PR URLs (one per worktree/ticket); filter out any agent that returned
null / failed. Tell the user:

- which tickets produced PRs (with links), and any **unresolved review findings** each PR carried
  from its step-3 `/code-review`;
- which failed and need a manual `/implement`;
- the **merge order** (dependency order), and that they own resolving any conflicts.

## Guardrails

- **Never fan out a blocked ticket.** Re-run this skill after a blocker's PR merges to pick up the
  newly-unblocked frontier.
- **Draft PRs only.** A fanned-out agent runs unattended and is lower-fidelity than a human-steered
  session — the human reviews before merge.
- **Cap concurrency.** A runaway fan-out is expensive; default 2–3.
- **One ticket's files per agent.** An agent that strays outside its ticket is a bug — its worktree
  should only ever contain its own ticket's changes.
