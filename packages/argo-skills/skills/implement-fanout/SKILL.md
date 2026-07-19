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

### 4. Integration check — detect, don't resolve

After all agents return, run one integrator agent (no worktree isolation needed — it works on a
throwaway branch it deletes):

- Branch `integration-check` off main; merge every ticket branch into it in dependency order.
- Where a merge conflicts, record the pair and the files/hunks, abort that merge, and continue
  with the rest — **never resolve here**.
- Run the full suite on whatever merged cleanly: two PRs can be conflict-free and still break
  each other (semantic conflicts the textual merge won't show).
- Delete the branch. Nothing is pushed, no PR is touched.

Resolution is deliberately out of scope: before any PR merges, every branch shares the same base,
so "resolving" would mean merging unmerged siblings into each other — coupling supposedly
independent PRs and changing what the human reviews. Conflicts become real only after the first
merge; that's step 6's job.

### 5. Collect and report

Gather the returned PR URLs (one per worktree/ticket); filter out any agent that returned
null / failed. Tell the user:

- which tickets produced PRs (with links), and any **unresolved review findings** each PR carried
  from its step-3 `/code-review`;
- which failed and need a manual `/implement`;
- the **conflict map** from step 4: which PR pairs collide and where, the merge order that
  minimizes conflicts, and whether the clean union passed the suite;
- that after each merge they can invoke the step-6 repair pass instead of resolving by hand.

### 6. After each merge — rebase and repair

Conflicts materialize one merge at a time, so this pass runs **per merge, on request** — it is
gated on the user's merge decisions and cannot live inside the fan-out workflow. After a PR
merges:

- rebase each surviving ticket branch onto updated main, using `resolving-merge-conflicts` when
  a rebase stops on the predicted (or a new) conflict;
- re-run the full suite in that branch's worktree; push with `--force-with-lease`;
- note in the PR body anything material the resolution changed.

Then re-scout: the merged PR may have unblocked new frontier tickets.

## Guardrails

- **Never fan out a blocked ticket.** Re-run this skill after a blocker's PR merges to pick up the
  newly-unblocked frontier.
- **Draft PRs only.** A fanned-out agent runs unattended and is lower-fidelity than a human-steered
  session — the human reviews before merge.
- **Cap concurrency.** A runaway fan-out is expensive; default 2–3.
- **Never merge unmerged branches into each other.** Cross-branch resolution before a PR lands
  couples independent tickets; the integration branch in step 4 is throwaway and detection-only.
- **One ticket's files per agent.** An agent that strays outside its ticket is a bug — its worktree
  should only ever contain its own ticket's changes.
