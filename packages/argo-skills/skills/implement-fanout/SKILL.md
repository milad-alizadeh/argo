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

> ### A workflow agent cannot spawn agents
>
> `agent()` calls inside a `Workflow` do **not** get the `Agent` tool. Any skill they invoke that
> works by spawning sub-agents — `/code-review` (two parallel axis agents), `/visual-verify` (a
> fresh judge) — cannot do so, and degrades to running in the implementer's own context. That
> means **the author reviews their own diff and judges their own screenshots**.
>
> The failure is silent. The work finishes, the PR opens, and its body says a review happened —
> the degradation shows up only as a buried aside like "this worker had no sub-agent tool, so
> both axes were single-context". Findings that a fresh reader catches immediately sail through,
> because the author is the last person able to see them.
>
> **So the orchestrator spawns the reviewer, never the implementer.** Review and visual judgement
> are separate workflow stages (step 3 below) — the workflow itself *can* spawn them. Never write
> a brief telling a workflow agent to "run `/code-review` on your own diff".

## Process

### 1. Scout the frontier (inline, in the main session — cheap)

- Read the open tickets from the issue tracker (see `docs/agents/issue-tracker.md`).
- Parse each ticket's `Blocked by:` edges into a dependency DAG.
- The **frontier** = tickets that are ready-for-agent **and** have no unresolved blocker (every
  blocker already merged/closed).
- Independence here is **DAG-level only**. Two frontier tickets may still touch the same files and
  merge-conflict later; that is expected and resolved at merge time, not here.

### 2. Confirm with the user (explicit opt-in + cost)

Fan-out spawns a build agent plus its independent reviewers per ticket — each ticket edits, tests,
gets reviewed by a separate context, then commits and opens a PR — so it costs meaningfully more
than N× a single ticket. Present, and get an explicit go before spawning:

- the frontier tickets you'll run (numbers + titles);
- the concurrency cap (default **2–3** at once; higher only if the user asks);
- that each opens a PR for the user to review and merge.

### 3. Fan out — build, then review in a *different* context

Each ticket is a `pipeline` of stages the **workflow** spawns. The build stage never reviews
itself; a separate agent, which has not seen the author's reasoning, does that:

```js
pipeline(frontier,
  // stage 1 — build. Returns the worktree path so later stages can re-enter it.
  t => agent(buildBrief(t),  { isolation: 'worktree', label: `build:#${t.number}`,  phase: 'Build' }),
  // stage 2 — review, in a fresh context that did not write the code.
  (built, t) => agent(reviewBrief(t, built), { label: `review:#${t.number}`, phase: 'Review' }),
  // stage 3 — the author addresses the findings, then opens the PR.
  (found, t) => agent(landBrief(t, found),   { label: `land:#${t.number}`,   phase: 'Land' }))
```

A reviewer re-enters the build's worktree with `EnterWorktree` using the `path` stage 1 returned,
so it reviews the real tree rather than a re-derived diff.

**Stage 1 — build.** Read ticket #N and build it following `/implement`: TDD at agreed seams,
typecheck / lint / single-file tests regularly, the full suite green at the end. Commit to a
ticket branch (`argo/#${N}-<slug>` or the repo convention). **Do not open a PR** — that is stage
3's job, after review. Return the worktree path and branch name.

**Stage 2 — review, in a fresh context.** Spawn one agent per axis, each told plainly that it did
not write this code and that the author's own confidence is not evidence:

- **Standards** — does it follow the repo's documented rules (`rules/`, `AGENTS.md`) plus the
  smell baseline?
- **Spec** — walk every acceptance criterion in the ticket independently; verify each in the code
  rather than trusting the author's claim.
- **Visual** — for anything rendered, a judge that takes *its own* screenshots and compares them
  against the design study. A judge that only looks at screenshots the author captured is
  inheriting the author's framing.

Reviewers are **read-only**: they report findings, they do not edit, commit, or push. Say so
explicitly in the brief — an agent told to "review" will otherwise helpfully start fixing.

**Stage 3 — address and land.** The author fixes what review found, re-runs the full suite, and
opens **exactly one PR** — body says `Closes #N`, embeds the visual screenshots, and lists every
finding it chose *not* to fix **with the reason**. A finding may be declined, but never silently:
the PR body is where the human sees the disagreement. Open ready-for-review; use draft only if
findings remain unresolved. **Return the PR URL.**

Do **not** merge. Do **not** touch any other ticket's files. One worktree → one branch → one PR.

`isolation: "worktree"` gives each agent its own working directory, index, and HEAD, so concurrent
agents can't clobber each other — the exact failure mode of running plain `/implement` in parallel
in one tree (amend landing on another session's commit, vanished stash, wrong-branch commits).

> **Cheaper, weaker variant.** Collapsing stages 2–3 into the build agent costs ~⅓ less and is
> what you get by default if you are not deliberate. It also means the author grades its own
> homework — see the harness warning above. Only do this for throwaway or mechanical batches, and
> tell the user the review was self-administered so they know to read the diff themselves.

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

- which tickets produced PRs (with links), and any **unresolved review or visual findings**
  each PR carried from its stage-2 review, **and whether that review ran in a fresh context** —
  if any ticket's review collapsed into the author's context, lead with that;
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
- **No agent reviews its own work.** The context that wrote the code cannot judge it — it knows
  what the code *meant* to do, which is exactly the knowledge that hides the defect. If for any
  reason review ends up running in the author's context, that is a **reportable failure**, not a
  degraded pass: say so to the user instead of letting the PR body imply a review happened.
- **Never merge.** PRs open ready-for-review because a separate reviewer saw the diff (stage 2) —
  but merging stays with the human, in dependency order.
- **Cap concurrency.** A runaway fan-out is expensive; default 2–3.
- **Never merge unmerged branches into each other.** Cross-branch resolution before a PR lands
  couples independent tickets; the integration branch in step 4 is throwaway and detection-only.
- **One ticket's files per agent.** An agent that strays outside its ticket is a bug — its worktree
  should only ever contain its own ticket's changes.
