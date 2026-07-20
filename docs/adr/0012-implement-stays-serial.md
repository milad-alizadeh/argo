# 0012 · `/implement` stays serial; delete `implement-fanout`

Status: accepted · 2026-07-20

## Context

`implement-fanout` fanned out DAG-independent tickets across worktrees — a build
agent plus two review agents and a land agent per ticket, plus a batch integrator
(~4×+ tokens, ~13 agents for a 3-ticket run). It was added in #12 and reshaped in
#38, #56, and #79, each pass patching its own failure modes: silent self-review
when review couldn't spawn its sub-agents, and merge coordination across the
parallel pile.

## Decision

**Delete it.** `/implement` — one ticket per fresh context, with the human as the
serialization point — is the only implement path.

## Why

- **Build wall-clock isn't the bottleneck; human review-and-merge is.** For a solo
  dev the review queue is strictly serial regardless of how builds ran, so fan-out
  optimizes the non-critical phase (Amdahl).
- **Human context-switching is the real, unpriced cost.** Independent PRs share no
  context, so reviewing a parallel pile forces a maximal cold reload per PR. The
  one-ticket-per-context rule protects the human's focus, not just the agent's.
- **The niche is rare.** A live 2+ independent frontier in batch-review mode is
  uncommon; most work is dependency chains or singles.
- **The machinery only existed to work around a harness limit** — Workflow agents
  can't spawn reviewers, so review was rebuilt as separate stages. Not something
  the task itself needs.

Reconciles with mattpocock's inbox model and Anthropic's "don't fan out builds"
guidance.

## Consequences

- Lose automated build-ahead for the rare independent frontier — done by hand (N
  worktrees manually) if ever wanted.
- Removes ~200 lines of caveat-dense skill plus the whole
  workflow-can't-spawn-reviewers failure surface.
