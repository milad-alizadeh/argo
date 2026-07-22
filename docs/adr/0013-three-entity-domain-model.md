# 0013 · Three-entity domain model: Work Item · Session · Delivery

Status: partially superseded (#182) · 2026-07-22

> **Superseded in part by the #182 rebuild** (see `CONTEXT.md` → L1):
> - **Work Item `type` (PRD|Task) is dissolved** into parent/child hierarchy — "PRD" and
>   "Task" are roles derived from whether a Work Item has children, not a stored field
>   (providers already model this via sub-issues / milestones).
> - **Session ↔ Work Item is a direct edge**, not "always through Delivery." The relationship
>   is a triangle (Session→WorkItem, Session→Delivery, Delivery→WorkItem), all optional and
>   many-to-many; the branchless planning-session-pinned-to-a-ticket case requires the direct
>   edge and is a user-asserted link Argo persists.
> - **Delivery is reclassified as *derived* and *branch-keyed*** (assembled from local git ∪
>   code-host facts), not computed per-Session.
>
> The three-entity core (Work Item · Session · Delivery, never fused; no session kinds;
> branch-keyed Delivery; zero-session Delivery is honest) **stands**.



## Context

Planning the cockpit's full workflow (ideation → code → deployment) kept producing
fuzzy hybrids: a single ranked list fusing tickets and running sessions, a
"session works on issue" link that broke the moment one session opened two PRs,
and session "kinds" (implement / grill / chat) that a session can outgrow
mid-run. Full model: superseded by `CONTEXT.md` (#182); retired design doc in git history.

## Decision

Three distinct entities, never fused:

- **Work Item** — intent. A ticket/sub-ticket; the provider is the single source
  of truth (Argo never stores them). One entity: `type` (PRD|Task) + `parent`
  (hierarchy) + `blockedBy[]` (dependency DAG). Raw ideation is a *stage*, not an
  entity.
- **Session** — observation. The CONTEXT.md session; stored distinction is
  `managed | external` only. **Sessions have links, not kinds** — what a session
  "is" emerges from observable links (intent/Delivery → implementing; `produces`
  → it created tickets; neither → just a session).
- **Delivery** — product in flight, **keyed to the branch → PR, never owned by a
  Session**. Carries the delivery lifecycle. May have zero sessions (a teammate's
  PR) — a first-class honest state.

Session ↔ Work Item is many-to-many and always joins **through Delivery**; no
direct session→ticket link is stored or guessed (except the managed `intent`
label at spawn).

## Why

- Nothing stops one session producing two PRs against two tickets; a
  branch-keyed Delivery represents that faithfully instead of special-casing it.
  One-PR-per-session stays a *nudge* (a second lifecycle strip is visibly
  heavier), never a model constraint.
- A Delivery spanning sessions (resume, handoff) has exactly one home: the
  branch. Git/GitHub already work this way.
- A stored session kind fabricates a genre (grilling is a skill run inside an
  ordinary chat); the `produces` link captures the effect without the guess.

## Consequences

- Work Item state (provider's field) and Delivery lifecycle (git/code-host
  reality) are separate, reconciled surfaces — a ticket can read `in-progress`
  while its Delivery reads `PR open · CI running`.
- The UI renders per-Delivery lifecycle strips inside whichever session views
  them; "one primary control" relaxes to one per active Delivery.
