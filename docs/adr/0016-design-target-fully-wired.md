# 0016 · Design target is the fully-wired install

Status: accepted · 2026-07-22

## Context

The honesty tiers (DIRECT / DERIVED / CONVENTION) form an adoption ladder: bare
observation works with nothing installed; a connected work-item provider lights
up DERIVED surfaces; the companion plugin lights up CONVENTION fields. The open
question was which rung the product is *designed for* — and whether the backlog
("what to work on next") is spine or optional. Details:
`CONTEXT.md` (#182; retired design doc in git history).

## Decision

- **Design for the fully-wired install**: Argo bundles and installs its companion
  plugin, and onboarding connects a Work Item provider. The backlog, work-item
  links, and prioritization are **spine, not optional** — without them the
  cockpit is "Claude CLI with a window."
- **Graceful fallback is a floor, not a target.** No provider / external session
  → dependent surfaces hide whole (no half-filled skeletons); nothing crashes.
  Supported, never optimized for.
- **Prioritization = sort vs judgement.** Provider priority is a *sort* Argo
  reflects (DIRECT). Argo's "what's next" is a *judgement* (DERIVED) over the
  `blockedBy` DAG, done-state, and sequencing — rendered as a suggestion with its
  reason visible, degrading honestly when dependency data is absent.
- Voice/Concierge is tier-independent — always works, narrates what's present.

## Why

- The DERIVED layer is the USP (a discovery partner that guides the next move);
  designing for its absence would optimize the product into a terminal wrapper.
- Built for the author first, released later — opinionated where it earns value
  (setup is part of the product), adapter-based where the world differs
  (ADR-0014).

## Consequences

- Onboarding (create Project, connect ports, install plugin) is in-scope product
  work, not an afterthought.
- Every surface spec must state its fallback behaviour (see
  `docs/designs/cockpit-surface-matrix.md` § Fallbacks).
