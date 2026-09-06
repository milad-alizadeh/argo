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
same branch.

**The measurements are still only in that page.** This design was approved before the rule that
a `.md` carries the numbers, and nothing has distilled them out of the HTML yet — so the page is
the spec, not a companion to one. The first `design-to-code` ticket against this screen writes
the measurements table here; until then, read the branch.

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

## When Atlas ships

The last ticket against this screen sets the front matter to `built`, records the commit, and
`bun run worktrees:gc` deletes `design/atlas` once #643 closes. This file and the renders beside
it are what stays.
