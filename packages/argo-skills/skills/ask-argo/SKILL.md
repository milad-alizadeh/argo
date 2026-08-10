---
name: ask-argo
description: Router for Argo's own skills, and for the design route ask-matt has no stage for. Use when the next step is unclear, when work touches a design or the token contract, or when the user asks what to run.
---

# Ask Argo

`ask-matt` maps the engineering flow: idea → ship. It has **no design stage**, because
it is an engineering map. This is the other half — Argo's own skills, and the one place
they change the shape of that flow rather than sitting beside it.

Read `ask-matt` for the main flow. Read this for where design fits and what to run.

## The fork `ask-matt` doesn't draw

Its step 2 asks: *can you settle every question in conversation?* If not, it sends you
to `/prototype`. That branch is **three ways, not two**, and picking wrong is the
single most common way a design ends up looking nothing like what was agreed:

- **Unsettled behaviour** — "does this state model work?" → `/prototype` (logic
  branch) → `/handoff` → back to the main flow at `/to-spec`.
- **Unsettled appearance** — "what should this screen look like?" → `/prototype` (UI
  branch, several variants) → **`/prototype-to-design`** → `/to-spec` → `/to-tickets`
  → **`/design-to-code`** per ticket.
- **Both** — prototype first, cheap and throwaway, then take its answer through the
  appearance route.

### Why appearance needs the extra step

`/prototype` rule 6 sends the prototype to a throwaway branch and keeps *"only the
validated decision"* on `main`. For a logic prototype that is right — the decision is a
sentence. For a UI prototype it is not: the decision is a set of **measurements**, and
prose loses every one of them. `/prototype-to-design` is the step that brings the
pixels and the tokens back to `main` so a ticket can be wrong about them.

Skipping it means every screen re-decides the visual direction from scratch, and
nothing downstream can tell a build bug from a design change.

## The design route, end to end

**Once per project**

1. **`/setup-design-infra`** — token contract, `docs/designs/` and its browser token
   mirror, the no-raw-values check, the render method, and `stack.md` (the five facts
   every later design skill reads instead of hardcoding your framework).
2. **`/setup-design-foundations`** — the moodboard→contract ceremony. Type ramp,
   spacing rhythm, colour roles, radii, motion — designed deliberately, blessed by you,
   rendered as a living specimen. **This is what makes designs converge**; without it
   every screen invents its own scale. Re-run any time as an audit.

**Per screen**

3. **`/frontend-design`** *(optional)* — aesthetic direction, when the screen needs a
   point of view rather than a layout.
4. **`/prototype`** — explore variants. Matt's skill, unchanged.
5. **`/prototype-to-design`** — approve one variant: losers deleted, every value snapped
   to a token or promoted behind a bless, the winner moved to `docs/designs/` speaking
   only tokens, a render committed beside it. **Once per screen.**
6. **`/design-to-code`** — build it: skeleton from primitives, components extracted only
   where evidence forces them, inventory written from those extractions, states covered.
   **Once per ticket.**
7. **`/pixel-review`** — a fresh agent judges the built screen against the approved
   render. The lens `code-review` cannot be: the diff is fine, the render is wrong.

## Reviews — three lenses, different questions

- **`code-review`** *(Matt's)* — the diff. Standards and spec.
- **`/pixel-review`** — the render against the approved design.
- The mechanical gates — lint, tests, no-raw-values. Run these **first**; never spend a
  review lens on something a linter catches.

## Setup — the rest of the rail

Usually dispatched by **`/setup-argo-skills`**, the wizard; run any directly to install
just that piece. Order matters only where noted.

- **`/setup-rules`** — the house engineering rules. **First**: the design skills read
  `design-system.md`, `designs.md`, `ui-components.md` from it.
- **`/setup-quality-gates`** — lint, duplication, per-file caps, as errors not warnings.
- **`/setup-module-boundaries`** — public-entry-only import rules and folder placement
  gates.
- **`/setup-graphify`** — the knowledge graph, and the hook that keeps it fresh.
- **`/setup-task-tracking`** — the live to-do list convention.
- **`/setup-output-style`** — how the agent talks back.

## Standalone

- **`/scaffold-project`** — a new project of any stack, from the ecosystem's own
  generator, with the language server wired into whichever agent is running.
- **`/ship`** — get finished work out.

## The one rule worth remembering

**A screen that reaches `/implement` without passing through `/prototype-to-design`
has no visual truth to be verified against.** Its tickets carry intent but no
measurements, `pixel-review` has nothing to judge it by, and the drift it produces is
invisible until someone opens the app and the design side by side.
