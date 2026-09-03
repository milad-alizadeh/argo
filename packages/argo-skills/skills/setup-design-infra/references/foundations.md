# The shape of a foundation

Reached from phase B of `SKILL.md`. Five families; colour alone has two layers.

1. **Colour.** Core ramps hold the raw values, theme-agnostic, named by what they are
   (`--gray-700`); semantic roles are named by job (`--background`, `--status-working`),
   defined per theme variant, and reference core only. Light and dark are two bindings of the
   same ramps. Alpha variants of a role are derived (opacity modifiers, `color-mix`), never
   new tokens. When designing from a histogram, collapse the observed hex onto ramp steps
   first, then map roles per theme variant; disjoint families (lifecycle status, severity)
   stay disjoint.
2. **Typography.** Stacks plus role tuples (size, line-height, weight, tracking) named by job.
   Adjacent roles sit at least 2px apart at small sizes; within a size, differentiate by
   weight, tracking or case.
3. **Space**, 4. **Shape** (radii), 5. **Motion** (durations and easings): one layer each,
   used directly. A one-off animation duration stays in its component.
