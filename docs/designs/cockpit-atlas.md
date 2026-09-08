<!-- status: approved
     approved-at: c443192d
     prototype: argo/#650-atlas-prototype
     explorable: design/atlas
     epic: #643 -->

# The Atlas

**Approved design** (#650, under the Atlas map [#643](https://github.com/milad-alizadeh/argo/issues/643)).
The repository as a place: every file is one volume, its ground is one measure, its height a
second and its light a third. Approved out of four variants — `atlas-holo` (the winner),
`atlas-model`, `atlas-night`, and `atlas-codecharta` as the control. What that exploration
settled is in [`prototypes/atlas-holo.md`](prototypes/atlas-holo.md) and is not re-argued here.

## The explorable is on `design/atlas`

This screen is still being built, so its page is still an input to a build. It lives on the
throwaway branch `design/atlas` and never on `main`:

```sh
git fetch origin design/atlas
git show design/atlas:docs/designs/cockpit-atlas.html > /tmp/cockpit-atlas.html
open /tmp/cockpit-atlas.html
```

States are reachable by `?state=<key>` — `map`, `inspect`, `treemap`, `domains`, `empty`,
`loading`, `error` — and `?render=1` strips the chrome for a PNG. The atlas prototypes and the
data they read (`prototypes/atlas-*.html`, `atlas-*.json`, `atlas-*.mjs`, `vendor/`) are on the
same branch. **Only the Atlas set is**: the branch was cut from `main` and its first commit
removes every other explorable, because the rest were deleted outright rather than archived.

**The measurements are still only in that page.** This design was approved before the rule that
a `.md` carries the numbers, and nothing has distilled them out of the HTML yet — so the page is
the spec, not a companion to one. The first `design-to-code` ticket against this screen writes
the measurements table here; until then, read the branch.

That makes the branch load-bearing in a way no other design branch is, and the sweep does not
know it: `worktrees:gc` deletes `design/atlas` the moment #643 closes, distilled or not.
**#643 must not close before the measurements are in this file.**

## What the page settles

- **The renderer is Metal.** Instanced flat-shaded boxes in an `MTKView` behind
  `NSViewRepresentable`, one instance per file, picked with an id buffer rather than a hit test.
  Not three.js, not RealityKit, not SceneKit (#650). Every number the design settles is therefore
  one a shader or a SwiftUI chrome layer can honour; the page computes the same arithmetic in JS
  so the picture can be judged before the port exists.
- **Two views, one camera.** City is the 3D view and the one that ships; Treemap is the same
  layout seen straight down. A single parameter runs 1 to 0, scaling heights, pushing the eye to
  infinity and gating every wall, shadow, sheen and rim. At 1 every expression reduces to the
  city, which is why adding the treemap could not change it.
- **Five token families are promoted**, each a contract change: the measure ramp, the domain
  wheel, the light model, the canvas ground and the inferred tier. The measure ramp is the one to
  read first — the prototype's own bands sat 0.03 to 0.09 from `state.running`, `state.attention`
  and `state.failure`, so a complex file and a crashed session were the same colour.

## Measurements — the floor, the vignette, the grain and the roof sheen

Distilled out of the page by #1600, which is the first pass at the table this file is supposed to
carry. **Only these six things.** Everything else the screen settles is still only in the page, and
the warning above still stands.

| What | The page's number | Where it lives now |
|---|---|---|
| The floor's plane | `FLOOR_Z = -22` of a 1000-unit plan | `AtlasElevation.dropShare = 0.022`, off the shorter side |
| How far the floor runs past the plan | `FLOOR_PAD = 0.018` | `AtlasElevation.padShare` |
| The graded ground | `#0b1015` at the middle, `#080c10` at 0.5, `--desktop` at 1, out to `max(W, H) * 0.72` | `atlas.materials.groundLit`, `groundDeep`, `desktop`; `AtlasGround.grade` |
| The vignette | `min(W, H) * 0.30` to `max(W, H) * 0.62`, landing on `--desktop` | `AtlasGround.falloff` |
| The plates' light on the floor | `rgba(70, 175, 205, 0.018 / (1 + depth * 0.45))` | `atlas.materials.fog` at `AtlasFloor.plateLight = 0.056`, `plateFalloff = 0.45` |
| The contour grid | 32 divisions of `fog` at 0.10, then 8 of `rgba(80, 178, 205, 0.055)` | `AtlasFloor.grid = [(32, 0.10), (8, 0.178)]`, both in `fog` |
| The grain | one 96px tile, values `118 + rand * 74`, `overlay` at 0.05 | `AtlasGrain.width`, `AtlasGrain.range`, `AtlasGround.grain`; spent as a multiply |
| The roof sheen | `ao * 1.07` at the lit corner, `ao * 0.93` at the far one | `ArgoLight.sheenFoot = 0.93 / 1.07`, pinned so the lit end is the face's own light |

Three of the page's numbers are put back onto a token rather than carried across as they are, and
each is arithmetic rather than taste:

- **The two raw cyans become `fog`.** The contract already names the floor's light — `fog`, "the
  floor's own light, which the contour grid takes" — and the page's `rgba(70, 175, 205)` and
  `rgba(80, 178, 205)` are that light from before it had a name. The weights carry the difference:
  0.018 of (70, 175, 205) is (1.26, 3.15, 3.69) of 255 and `fog` at 0.056 is (1.46, 2.91, 3.58);
  0.055 of (80, 178, 205) is (4.4, 9.8, 11.3) and `fog` at 0.178 is (4.6, 9.3, 11.4).
- **The grain is a multiply, not an `overlay`.** Overlay's own dark branch composites to
  `b * (1 + a * (2s - 1))` — a scalar on the finished pixel, which is what a multiply blend is —
  and the two part only above half brightness, by at most 0.0037, under one 8-bit step. A multiply
  is also the only one of the two that cannot wash a channel toward white, which nothing on this
  map may do.
- **The sheen is pinned rather than centred.** The page runs it 1.07 against 0.93 about the shade a
  face reads at. Spent upward on this contract's roof factor, a hot roof lands 0.195 from its
  legend swatch and `ArgoLight.legendTolerance` bounds that at 0.15. The ratio across the roof is
  the page's exactly; the lit end is the face's own light rather than 7% above it.

## When Atlas ships

The last ticket against this screen sets the front matter to `built`, records the commit, and
`bun run worktrees:gc` deletes `design/atlas` once #643 closes. This file and the renders beside
it are what stays.
