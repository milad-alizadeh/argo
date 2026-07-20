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
> works by spawning sub-agents — `/code-review` (two parallel axis agents) — cannot do so, and
> degrades to running in the implementer's own context. That means **the author reviews their own
> diff**.
>
> The failure is silent. The work finishes, the PR opens, and its body says a review happened —
> the degradation shows up only as a buried aside like "this worker had no sub-agent tool, so
> both axes were single-context". Findings that a fresh reader catches immediately sail through,
> because the author is the last person able to see them.
>
> **So the orchestrator spawns the reviewer, never the implementer.** The review axes are separate
> workflow stages (step 3 below) — the workflow itself *can* spawn them. Never write a brief
> telling a workflow agent to "run `/code-review` on your own diff".

## Process

### 1. Scout the frontier (inline, in the main session — cheap)

- Read the open tickets from the issue tracker (see `docs/agents/issue-tracker.md`).
- Parse each ticket's `Blocked by:` edges into a dependency DAG.
- The **frontier** = tickets that are ready-for-agent **and** have no unresolved blocker (every
  blocker already merged/closed).
- Independence here is **DAG-level only**. Two frontier tickets may still touch the same files and
  merge-conflict later; that is expected and resolved at merge time, not here.

### 2. Confirm with the user (explicit opt-in + cost)

Fan-out spawns a build agent plus two review agents and a land agent per ticket — each ticket
edits, gets reviewed by two separate contexts, then fixes and opens a PR — so it costs meaningfully
more than N× a single ticket. Because the stages pipeline, wall-clock is roughly **one ticket's
build→review→land chain**, not the sum — so adding tickets is nearly free, and the lever on total
time is per-stage cost (model tier, land scope), not parallel width. Present, and get an explicit go
before spawning:

- the frontier tickets you'll run (numbers + titles);
- the concurrency cap (default **2–3** at once; higher only if the user asks);
- that each opens a PR for the user to review and merge.

### 3. Fan out — build, then review in a *different* context

Each ticket is a `pipeline` of stages the **workflow** spawns. The build stage never reviews
itself; a separate agent, which has not seen the author's reasoning, does that:

```js
pipeline(frontier,
  // stage 1 — build. Returns the worktree path so later stages can re-enter it.
  t => agent(buildBrief(t), { isolation: 'worktree', label: `build:#${t.number}`, phase: 'Build' }),
  // stage 2 — review: two axes (standards, spec) IN PARALLEL, each a fresh context that did not
  //           write the code. No visual axis — CI's stories job owns that (see below).
  (built, t) => parallel(['standards', 'spec'].map(ax => () =>
    agent(reviewBrief(ax, t, built), { label: `review-${ax}:#${t.number}`, phase: 'Review' })))
    .then(axes => ({ built, axes: axes.filter(Boolean) })),
  // stage 3 — the author fixes blocker/major, pushes, opens the PR (minors ride as PR comments).
  (reviewed, t) => agent(landBrief(t, reviewed), { label: `land:#${t.number}`, phase: 'Land' }))
```

The two review axes run **inside a `parallel()` within the stage-2 callback** — that is script code,
so the workflow spawns them; a stage-2 *agent* could not. Model tier is a lever: default to `sonnet`
for every stage (it ran apply/review 2–3× faster than opus with no quality loss on this kind of
componentization work), reaching for a stronger model only on a genuinely hard verify.

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

Two axes, not three. **Do not spawn a visual reviewer.** The CI visual-regression gate (the
`stories` job, added in #66) screenshots every story and diffs it against the committed baseline
on the PR itself — so a per-run visual judge is now redundant work on the critical path, and it was
the most expensive axis (10–14 min against 4–6 for standards/spec). Rendered output is verified
after the branch pushes, by CI, on Linux baselines the human approves from the PR. Reserve
`/visual-verify` for a *subjective* state that has no story (run it yourself, inline, before the
fan-out or after a merge) — never wire it as a fan-out stage.

Reviewers are **read-only**: they report findings, they do not edit, commit, or push. Say so
explicitly in the brief — an agent told to "review" will otherwise helpfully start fixing.

**Stage 3 — address and land.** Land is a fix-and-ship stage, not a second build — keep it that way
or it costs as much as stage 1 (it did: 25 min, matching build, when it fixed all N findings and
re-ran everything).

- **Fix only `blocker` and `major` findings.** `minor`/`nit` findings ride into the PR body as an
  "Unaddressed review findings" list for the human to accept or wave through — they do **not** block
  the PR. Declined `major`/`blocker` findings are still listed with a reason; a finding may be
  declined, but never silently, and the PR body is where the human sees the disagreement.
- **Re-run the affected tests, not the whole suite.** The full suite already ran green at the end of
  stage 1, and CI re-runs it on push — so stage 3 only needs to prove *its own* fixes: typecheck
  plus the test files touching the changed code (`vitest run <paths>` / `--changed`). Full-suite
  green is CI's job, not a thing to pay for twice on the critical path.
- Open **exactly one PR** — body says `Closes #N`. Open ready-for-review; use draft only if a
  `blocker`/`major` is left unresolved. **Return the PR URL.**

Do **not** merge. Do **not** touch any other ticket's files. One worktree → one branch → one PR.

`isolation: "worktree"` gives each agent its own working directory, index, and HEAD, so concurrent
agents can't clobber each other — the exact failure mode of running plain `/implement` in parallel
in one tree (amend landing on another session's commit, vanished stash, wrong-branch commits).

> **Cheaper, weaker variant.** Collapsing stages 2–3 into the build agent costs ~⅓ less and is
> what you get by default if you are not deliberate. It also means the author grades its own
> homework — see the harness warning above. Only do this for throwaway or mechanical batches, and
> tell the user the review was self-administered so they know to read the diff themselves.

### 4. Integration check — detect, don't resolve

Run one integrator agent (its own throwaway worktree, so it never disturbs the shared checkout):

- Branch `integration-check` off main; merge every ticket branch into it in dependency order.
- Where a merge conflicts, record the pair and the files/hunks, abort that merge, and continue
  with the rest — **never resolve here**.
- Run **the affected tests** on whatever merged cleanly — the parts touched by more than one branch,
  where a semantic conflict the textual merge won't show would hide. The full suite is CI's job on
  each PR; the integrator only needs to catch cross-branch breakage, not re-audit each branch.
- Delete the branch. Nothing is pushed, no PR is touched.

This is a serial tail (it needs every branch pushed before it can merge them), so keep it cheap — it
is detection, not verification. It does **not** gate the PRs, which are already open from stage 3; it
just hands the human the conflict map. If a run has only one ticket left landing, the integrator can
begin on the branches already pushed and re-check once the last lands, rather than idling for it.

Resolution is deliberately out of scope: before any PR merges, every branch shares the same base,
so "resolving" would mean merging unmerged siblings into each other — coupling supposedly
independent PRs and changing what the human reviews. Conflicts become real only after the first
merge; that's step 6's job.

### 5. Collect and report

Gather the returned PR URLs (one per worktree/ticket); filter out any agent that returned
null / failed. Tell the user:

- which tickets produced PRs (with links), the **unaddressed `minor`/`nit` findings** each PR
  carried into its body, plus any declined `major`/`blocker`, **and whether the review ran in a
  fresh context** — if any ticket's review collapsed into the author's context, lead with that;
- a reminder that each PR's **visual gate runs in CI** — the human reviews rendered diffs there
  (swipe/onion-skin on the PR's Files-changed), not from screenshots in the PR body;
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
