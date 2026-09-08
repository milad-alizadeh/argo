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
carry. **Only what #1600 built**: the floor and its two measures, the graded ground, the vignette,
the plates' light, the contour grid, the grain and the roof sheen. Everything else the screen
settles is still only in the page, and the warning above still stands.

| What | The page's number | Where it lives now |
|---|---|---|
| The floor's plane | `FLOOR_Z = -22` of a 1000-unit plan | `AtlasElevation.dropShare = 0.022` |
| How far the floor runs past the plan | `FLOOR_PAD = 0.018` | `AtlasElevation.padShare` |
| The graded ground | `#0b1015` at the middle, `#080c10` at 0.5, `--desktop` at 1, out to `max(W, H) * 0.72` | `atlas.materials.groundLit`, `groundDeep`, `desktop`; `AtlasGround.grade` |
| The vignette | `min(W, H) * 0.30` to `max(W, H) * 0.62`, landing on `--desktop` | `AtlasGround.falloff` |
| The plates' light on the floor | `rgba(70, 175, 205, 0.018 / (1 + depth * 0.45))` | `atlas.materials.fog` at `AtlasFloor.plateLight = 0.0589`, `plateFalloff = 0.45` |
| The contour grid | 32 divisions of `fog` at 0.10, then 8 of `rgba(80, 178, 205, 0.055)` | `AtlasFloor.grid = [(32, 0.10), (8, 0.185)]`, both in `fog` |
| The grain | one 96px tile, values `118 + rand * 74`, `overlay` at 0.05 | `AtlasGrain.side`, `AtlasGrain.range`, `AtlasGround.grain` |
| The roof sheen | `ao * 1.07` at the lit corner, `ao * 0.93` at the far one | `ArgoLight.sheenFoot = 0.93 / 1.07`, pinned so the lit end is the face's own light |

Four of the page's numbers are read differently in the port, and each is arithmetic rather than
taste.

**The two raw cyans become `fog`.** The contract already names the floor's light — `fog`, "the
floor's own light, which the contour grid takes" — and the page's `rgba(70, 175, 205)` and
`rgba(80, 178, 205)` are that light from before it had a name. The weight carries the difference,
matched on LUMINANCE at Rec. 709, which is what a reader sees: `fog` is (26, 52, 64) and reads
47.34 of 255; (70, 175, 205) reads 154.84, so 0.018 of it is 2.787 and `fog` needs 0.0589; (80,
178, 205) reads 159.12, so 0.055 of it is 8.752 and `fog` needs 0.185. Per channel `fog` is
warmer than the page's cyan by about a sixth in red, on a contribution of three parts in 255 over
a near-black ground.

**The floor's two measures are shares of the SHORTER side.** The page's plan is a 1000-unit
square, so `FLOOR_Z` and `FLOOR_PAD` are shares of a span with only one length. Argo tiles into
the window's own extent, which is not square, and `AtlasElevation` already measures every
plan-relative height off the shorter side for a stated reason: a tower measured off the longer
side of a wide map overhangs the short one. The floor follows the heights it hangs under.

**The grain is the page's `overlay`, and it is not a multiply.** It is spent on each opaque
surface's own finished pixel rather than as a fill over the picture, because the only blend Metal
offers here is a multiply and a pass that reads the colour attachment back is not portable — and
every visible pixel is written by exactly one surface, so the arithmetic is the fill's. The
multiply was tried and is wrong: below half brightness the two are one expression, since overlay's
dark branch composites to `b * (1 + a * (2s - 1))`, but above it they part by
`a * (2b - 1) * (1 - 2s)` — up to 0.019, five 8-bit steps, on the brightest channel this map
draws. All of that difference lands on the lit roofs, and the whole tolerance is there: a middling
roof at its lit corner sits 0.135 from its legend swatch of the 0.15 `ArgoLight.legendTolerance`
allows, and the multiply spent 0.163 of it. Overlay compresses toward white and barely moves a lit
roof; a multiply lifts it by its full 2.5%.

**The sheen is pinned rather than centred.** The page runs it 1.07 against 0.93 about the shade a
face reads at. Spent upward on this contract's roof factor of 1.1344, a middling roof lands 0.215
from its legend swatch and a hot one 0.195, against the same 0.15. The ratio across the roof is
the page's exactly; the lit end is the face's own light rather than 7% above it.

## When Atlas ships

The last ticket against this screen sets the front matter to `built`, records the commit, and
`bun run worktrees:gc` deletes `design/atlas` once #643 closes. This file and the renders beside
it are what stays.
