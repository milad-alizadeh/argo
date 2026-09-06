# 0031 · A backlog question runs on `codex exec`

Status: accepted · 2026-09-05 (#1315)

Binding on `apps/macOS`. Adds `BacklogAskPort` and its one adapter, `CodexBacklogAsk`, in
`ArgoEngine`. It applies [ADR-0024](./0024-session-drive-port-two-adapters.md)'s billing finding to
a path that is not a Session.

## Context

The asking surface (#1293, `docs/designs/cockpit-backlog-question.md`) lets a reader ask the
backlog a question in prose and get prose back: *is there a ticket for this thing, and what state
is it in?* The search field it sits beside matches a substring of the number and the title and
nothing else, which is a good field and cannot answer that.

Answering it means sending a question and a listing to a model. Argo has three ways to reach one,
and they do not cost the same.

| route | credential | billing |
| --- | --- | --- |
| `claude -p` | the subscription's own token | metered per token |
| the Agent SDK | an API key | metered per token |
| `codex exec` | the ChatGPT sign-in in `CODEX_HOME/auth.json` | included in the subscription |

**This repo runs on subscription-included tokens.** That is a standing constraint here, not a
preference for this feature: the Swift gate moved to push time because one macOS runner was about
99% of a $50/day Actions bill (AGENTS.md, **Quality gates**), and a per-question metered call in a
cockpit a reader keeps open all day is the same shape of surprise. Claude Code keeps subscription
billing on its interactive TUI
only — `-p` is the headless surface and meters — so the one route that stays included is Codex's.

ADR-0024 already found why: **Codex splits its billing on the credential, not on the surface.** A
`codex` run signed in through ChatGPT draws on the subscription whichever surface it is, which is
what makes a non-interactive `codex exec` usable where a non-interactive `claude` is not. That
finding was made about spawned Sessions, and `AgentCLI.codex.scrubbedFromEnvironment` is the guard
it produced: `OPENAI_API_KEY` never travels to a spawned Codex, because Codex 0.147.0 was observed
to prefer the ChatGPT sign-in but a later version preferring the key would meter silently.

## Decision

**A backlog question is asked through `codex exec`, on the Codex CLI's own ChatGPT sign-in.**

Four things follow, and each is a line of code rather than a note:

1. **The sign-in is checked before the process starts.** `auth.json` must hold `tokens`; a file
   holding `OPENAI_API_KEY` instead is refused as "not a ChatGPT sign-in" rather than asked. The
   credential is the fact this rests on — the `chatgpt_plan_type` claim is drawn beside the answer
   and decides nothing, because a token can carry the sign-in and omit the claim.
2. **The environment is scrubbed with ADR-0024's own list.** `CodexExecRun.environment` reads
   `AgentCLI.codex.scrubbedFromEnvironment`, so a name added there covers this path the day it is
   added, and there is no second rule to drift from the first.
3. **`--ignore-user-config`**, so a `config.toml` on this machine naming another provider cannot
   quietly move the question to a metered one. Auth still comes from `CODEX_HOME`.
4. **`--ephemeral`, `--sandbox read-only` and an empty scratch directory as the working root.**
   Asking a question adds no Session to the roster, writes nothing to `CODEX_HOME`, and gives a
   model that ignored its prompt no repository to read.

**The question is answered from the listing alone** — number, title, status, type, priority,
labels and the `blockedBy` edges. Never a ticket body, never a comment. A `Ticket` carries `body`,
filled for whichever tickets a reader happened to open, so an answer written from bodies changes
between two readers of the same view; repeatable is the property that lets anybody check the
answer. `BacklogListingTests` asserts it against a fixture whose bodies contradict its titles.

**Every failure is a stated refusal.** `BacklogAskRefusal` has four cases — no sign-in, no CLI, a
timeout, and a non-zero or empty exit — and each carries a sentence. An exit of 0 that wrote
nothing is refused as loudly as a crash: a blank sheet reads to a reader as *the backlog has
nothing to say*, which is a claim about the backlog rather than about Argo.

## What was measured

Over the nine-ticket fixture, `codex-cli` 0.147.0, four question shapes, three runs
(`ARGO_MEASURE_ASK=1`):

| run | least | median | most |
| --- | --- | --- | --- |
| 1 | 4418 ms | 4717 ms | 6602 ms |
| 2 | 4457 ms | 5033 ms | 5186 ms |
| 3 | 4403 ms | 4873 ms | 5223 ms |

Over a 40-ticket listing of this repo's real open issues, six questions: 5.2 s least, ~6 s
typical, 11.4 s worst.

**The floor is about 4.4 s and it does not move.** The design draws `2.4s`, which was plausible
rather than measured; nothing observed here came within 1.8× of it, and the listing that a real
project would ask over is four times the fixture's size. `docs/designs/cockpit-backlog-question.md`
is corrected in the same change.

**The listing is enough to cite from.** All four fixture answers named the right ticket, and three
of them could not have been reached by substring: "the build being slow in a new worktree" found
#2 (*Warm the Swift build…*), the edge question traversed `blockedBy` to name #6 as the one that
must land first, and the Stripe question was declined rather than guessed. The priority answer
kept Argo's own degrade-down — *"#3 has no priority listed"* rather than a tier nothing set.

## Why not the alternatives

**`claude -p`** is the natural reach in this repo and it meters. Nothing about the code would
differ; the bill would.

**The Agent SDK** is a better API and needs an API key, which is the same objection with more
plumbing.

**A local model** costs nothing and was not tried. It is the route to revisit if OpenAI changes
what a ChatGPT sign-in covers — which is the one change that would reopen this decision.

## Consequences

- Argo now depends on the `codex` CLI for a feature that is not a Session. A reader with `claude`
  and no `codex` gets the `noCLI` refusal, which is a real gap in the cockpit's story and belongs
  in the asking surface's own vacancy state (`BacklogAskVacancy`).
- The answering identity is **DERIVED, not an Account.** `AccountProvider` is `github | linear`,
  and those are grants Argo issued and holds in the keychain. Codex's sign-in is the CLI's, and
  Argo only reads it — so `CodexSignIn` is its own value and the attribution renders as the lower
  tier (`CONTEXT.md` L2 · Honesty tier). Adding `AccountProvider.codex` would render a DIRECT claim
  over a grant Argo cannot vouch for.
- A ~4.4 s floor is a wait a sheet has to be designed around rather than hidden. That is the
  design's call, and #1315 hands it the number.
