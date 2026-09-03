---
name: setup-design-foundations
description: Settle the token values (type ramp, spacing, colour roles, radii, motion) from observed usage, blessed by the user, landed in the contract with a living specimen; re-run as an audit.
disable-model-invocation: true
---

# Setup Design Foundations

Run once after `setup-design-infra`, before the first screen is approved; re-run any time as
an audit. `prototype-to-design` reconciles a screen against these foundations and never
designs a scale.

## The shape of a foundation

Five families. Colour alone has two layers:

1. **Colour.** Core ramps hold the raw values, theme-agnostic, named by what they are
   (`--gray-700`); semantic roles are named by job (`--background`, `--status-working`),
   defined per theme variant, and reference core only. Light and dark are two bindings of
   the same ramps. Alpha variants of a role are derived (opacity modifiers, `color-mix`),
   never new tokens.
2. **Typography.** Stacks plus role tuples (size, line-height, weight, tracking) named by
   job. Adjacent roles sit at least 2px apart at small sizes; within a size, differentiate by
   weight, tracking or case.
3. **Space**, 4. **Shape** (radii), 5. **Motion** (durations and easings): one layer each,
   used directly.

## 1. Gather the raw material

From whatever exists, in order: moodboard or specimen pages, the flagship prototype, the
app's existing styles, reference screenshots. If nothing exists, generate one throwaway
specimen page per family and review it with the user first.

Done when there is one histogram (value × use-count) per property: size, weight, tracking,
line-height, space, radius, duration, colour.

## 2. Design each family from the histograms

Cluster the observed values, choose the role set (drop roles the product doesn't use, invent
none), pin each role to a clean value at most a snap away from its cluster, complete each
tuple from the dominant observed pairing, and snap off-step observations to a neighbour. For
colour, collapse the observed hex onto ramp steps first, then map roles per theme variant;
disjoint families (lifecycle status, severity) stay disjoint. A one-off animation duration
stays in its component.

Done when every observed value maps to exactly one proposed token or a named component-local
exception, with every row where judgement moved a value flagged, and by how much.

## 3. Bless checkpoint

Present one table per family: observed cluster → proposed token (name and value), judgement
rows called out with alternatives. The user adjusts and blesses.

Done when the user has answered each family's table; an unanswered table blocks §4.

## 4. Land the contract

Every family, every theme variant, full tuples, in the contract `stack.md` names, with the
framework wiring in the same change; then regenerate the mirror with the command it records.

Done when the no-raw-values check passes on the contract's consumers.

## 5. Render the living specimen

`docs/designs/foundations.html` imports the mirror and renders every role: a line per type
role, spacing blocks, the core ramps plus semantic chips per theme, radius and motion demos.
It styles only via `var(--token)`, so it always shows the current contract; link it first in
the designs README.

Done when every token name in the contract appears in the page (grep both, diff empty).

## 6. Re-base approved designs, when values moved

Snapped jitter (≤1px) leaves existing designs untouched. When the bless deliberately moved
values, translate each approved design through the mapping tables (substitute each raw value
for its token), re-render the PNG beside it, and match each visible delta to the mapping row
that explains it.

## 7. Report

Per family: what was settled, which judgement calls moved values and by how much.

## Re-running as an audit

Re-extract current usage (approved designs plus app source), compare against the contract,
and present only the drift: tokens nothing uses, values nothing names, families still
missing, jitter that leaked into the contract. Fix through the same bless → land → specimen
loop.
