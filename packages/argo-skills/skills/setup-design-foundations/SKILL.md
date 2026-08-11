---
name: setup-design-foundations
description: Design a project's type ramp, spacing rhythm, colour roles, radii and motion, bless them, and land them in the token contract. Once per project, or any time as an audit.
disable-model-invocation: true
---

# Setup Design Foundations

Foundations come **before screens**: a scale derived as a by-product of one screen's
settle inherits that screen's exploration jitter — half-pixel sizes, missing rungs,
one screen's accidents enshrined as law.

Run it **once per project**, after `setup-design-infra` has installed the token
*structure* and before the first screen design is approved. Re-run it any time as an
**audit**. The `prototype-to-design` skill then only *reconciles* a screen against
these foundations; it never designs a scale.

## The shape of a foundation

Five families. Colour — and only colour — gets two layers:

1. **Colour.**
   - **Core ramps** — raw values live *only* here; theme-agnostic; named by what
     they are (`--gray-700`, `--indigo-500`). Small ramps per hue the design
     actually uses. A design needing "a grey" picks a step — it never invents hex;
     hex jitter is what happens when no ramp exists to reach for.
   - **Semantic roles** — named by job (`--background`, `--primary`,
     `--status-working`); defined per theme variant (`:root`/`.dark`); reference
     core only (`var(--gray-900)`), never a raw value. Light and dark are two
     *bindings* of the same ramps, not two palettes.
   - **Derived, not tokenized** — alpha variants of a role use opacity modifiers
     (`bg-primary/20`, `color-mix`), never a new hex.
2. **Typography** — stacks (sans/mono) plus role tuples (size + line-height +
   weight + tracking), named by job. Size steps mark real hierarchy jumps only —
   adjacent roles ≥2px apart at small sizes; within a size, differentiate by
   weight/tracking/case, never by a 1px size step.
3. **Space** — the rhythm steps. One layer.
4. **Shape** — radius steps. One layer.
5. **Motion** — shared durations + easings. One layer.

App components and designs speak only semantic; space/radius/motion steps are
single-layer and used directly.

## 1. Gather the raw material

Work from whatever exploration exists, in preference order: moodboard or specimen
pages, the flagship screen's prototype, the app's existing CSS, reference
screenshots. Extract every used value per family:

```bash
grep -oE 'font-size:\s*[^;]+' <file>.html | sort | uniq -c | sort -rn
```

…and equivalents for font-weight, letter-spacing, line-height,
padding/gap/margin, border-radius, transition durations, and colors (hex +
rgba). The histograms — value × use-count — are the input to every decision
below.

If **nothing** exists yet, this step *is* the moodboarding: generate one
throwaway specimen page per family (type-ramp candidates at different
densities, color swatches, spacing blocks), review it in the browser with the
user, then continue.

## 2. Design each family — deliberately, not by averaging

The histograms show where the designer's eye kept landing; name those places and
clean them up.

- **Typography** — cluster the observed sizes; choose the role set (from
  micro / label / body / body-lg / title / heading / display — drop roles the
  product doesn't use, never invent unused ones); pin each role to a **clean
  value** (integer px, or the stack's native unit) at most a snap away from its
  cluster; complete the tuple — size, line-height, weight, tracking — from the
  dominant observed pairing. Exploration jitter (11 vs 11.5px) dies here: **the
  token takes the clean value even though the exploration keeps its jittered one.**
- **Spacing** — collapse the padding/gap/margin histogram to a few named rhythm
  steps; off-step observations snap to a neighbor.
- **Color** — first the core ramps (collapse observed hex jitter onto ramp
  steps), then the semantic mapping per theme variant. Disjoint families
  (lifecycle status, verdict/severity) stay disjoint. Alpha variants of an
  existing role are *derived* (opacity modifiers, `color-mix`), never new
  tokens.
- **Radii / motion / opacity** — as actually used. Shared interaction timings
  become tokens; a one-off animation duration stays in its component.

Flag every row where judgment moved a value, and by how much.

## 3. Bless checkpoint — nothing lands without it

Present one table per family: observed cluster → proposed token (name + value),
judgment rows called out with the alternatives. The user adjusts and blesses.
This is the single human step of the ceremony; it is never skipped, and no
session lands foundation values without it.

## 4. Land the contract

- Token file: every family, every theme variant, full tuples — and the
  framework wiring (`@theme` block, `createTokens()`, or the Style Dictionary
  build) in the same change.
- Refresh the browser mirror (`docs/designs/tokens.css`) so designs immediately
  speak the new vocabulary. When the contract is not itself CSS — a Swift
  `VisualContract`, a Kotlin theme — this is an **export step**, not a copy: the
  mirror is generated from the contract so it cannot disagree with it.

## 5. Render the living specimen

Create `docs/designs/foundations.html`: it imports the mirror and renders every
role — a specimen line per type role (name, tuple, sample text), spacing blocks,
the core colour ramps plus semantic chips per theme, radius and motion demos.
Because it styles **only** via `var(--token)`, opening it always shows the
current contract — it cannot drift. This is the one page in `docs/designs/` that
is *not* disposable; link it first in the designs README.

## 6. Re-base the approved designs — when values moved

If the blessed settle only snapped jitter (≤1px, invisible), existing designs
stay untouched. But when it **deliberately moved values** — collapsed size
steps, consolidated colour families, re-spaced hierarchy — every approved design
is now a pre-settle draft, and every later parity check degenerates into
"blessed delta or build bug?". Re-base them: mechanically translate each through
the mapping tables (import the mirror, substitute each raw value for its
`var(--token)`/role class; blessed component-local exceptions keep their
literals with a comment). Translation, not redesign — no new judgment calls.
Re-render the PNG beside each one, and verify the only visible deltas are the
blessed ones. The markup still never ports to the app.

## 7. Report

Per family: what was settled, which judgment calls moved values and by how
much. Then the rule going forward: new work starts from the template with these
tokens loaded; a prototype inventing a value marks it as a **proposal**, and
`prototype-to-design` reconciles proposals at approval time — a promotion there
is a *contract change* and comes back through a mini version of step 3.

## Re-running as an audit

Same ceremony in diff mode: re-extract current usage (approved designs + app
source), compare against the contract, and present only the drift — tokens
nothing uses, values nothing names, families still missing, and any jitter that
leaked into the contract itself. Fix through the same bless → land → specimen
loop.
