# 0015 · Project is the scope

Status: accepted · 2026-07-22

## Context

Sessions are inherently per-project (a CLI runs inside one repo), and both ports
are configured per repo — but the cockpit observes work across several projects
(Argo, day job). A first draft scoped some surfaces globally (Roster) and some
per-project (Work room); mixed scoping was rejected: consistency is key, and
every future surface would re-answer the question. Details:
`docs/designs/cockpit-domain-model.md` § Project.

## Decision

**The window shows one active project; the only cross-project surfaces are the
project strip and the Concierge.**

- **Project** is the entity that owns adapter config (work-item provider, code
  host, preview sources) plus the repo root. Onboarding = creating a Project.
- **Project strip** — thin far-left vertical tabs (Slack-workspace idiom), one
  icon per project, carrying the attention badge; click swaps the whole window.
- **Concierge** — the voice is global by nature (one mic) and may narrate
  cross-project.
- Everything else — Roster, Work room, home, orb — inherits the active project
  with zero per-surface decisions.

## Why

- One-sentence rule every surface inherits; no per-surface grouping tax.
- The supervision problem (a hidden session in another project needs input) is
  solved *outside* the scope — badge + voice — instead of by breaking it.
- Proven pattern (Slack/Discord); users already know it.

## Consequences

- Cross-project backlog merging never exists (priorities don't compare across
  repos anyway).
- `Session ──belongs to──▶ 1 Project` is DIRECT (resolved from cwd), never a
  user choice.
