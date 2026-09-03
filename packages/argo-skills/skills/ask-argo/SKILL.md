---
name: ask-argo
description: Which Argo skill or design step fits your situation. A router.
disable-model-invocation: true
---

# Ask Argo

`ask-matt` maps idea → ship and has no design stage. This maps the design route and
Argo's own skills.

## The fork `ask-matt` doesn't draw

When a question cannot be settled in conversation, `ask-matt` sends you to `/prototype`.
That branch is three ways, not two:

- **Unsettled behaviour** ("does this state model work?") → `/prototype` (logic) →
  `/handoff` → back to the main flow at `/to-spec`.
- **Unsettled appearance** ("what should this screen look like?") → `/prototype` (UI,
  several variants) → `/prototype-to-design` → `/to-spec` → `/to-tickets` →
  `/design-to-code` per ticket → `/pixel-review`.
- **Both** → prototype first, cheap and throwaway, then the appearance route.

A UI prototype's decision is a set of measurements, and prose loses every one of them;
`/prototype-to-design` is what brings them to `main` so a ticket can be wrong about them.

## The design route

- **`/setup-design-infra`**, once per project: the token contract, `docs/designs/`, the
  no-raw-values check, the render method, and `stack.md`.
- **`/setup-design-foundations`**, once per project and again as an audit: the type ramp,
  rhythm, colour roles, radii and motion, designed and blessed.
- **`/frontend-design`**, per screen when it needs a point of view rather than a layout.
- **`/prototype`**, per screen: explore variants.
- **`/prototype-to-design`**, once per screen: approve one variant.
- **`/design-to-code`**, once per ticket: build it.
- **`/pixel-review`**, per change: a fresh agent judges the render against the design.

## Reviews

`code-review` judges the diff, `/pixel-review` the render, and the mechanical gates run
before either.

## Everything else

- **`/setup-argo-skills`** bootstraps a project and dispatches each setup piece in order.
- **`/audit-agent-context`** prices what a session loads and proposes the cuts. Run it when
  context feels expensive, and after a setup run.
- **`/scaffold-project`** starts a new project of any stack from its own generator.
- **`/ship`** commits, pushes and opens the PR.
