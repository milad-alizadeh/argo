# Snap zoom vs free zoom: how the field does it

Research report. Companion to `atlas-labels-prior-art.md`.

Snap zoom on plates is accepted in principle, so this report is about **how**, not whether.
The crux — **camera animation versus layout change** — is settled below with source evidence,
and it does have a clear answer.

**Headline: the field is split, but not evenly, and the split runs along product category
rather than being a muddle. Among interactive zoomable treemap libraries, keeping the layout
fixed and moving only the camera wins 4–1. Among desktop disk-usage tools, re-rooting wins
7–0.** Atlas is the former kind of thing. Our existing decision — geometry fixed, scope shown
by dimming and a breadcrumb — is what the closest prior art does. **Following the field means
keeping that decision, not overturning it.**

---

## 1. Inventory

| System | Model | **Camera or layout?** | Levels above | Way back out | Free zoom too? | Animation |
|---|---|---|---|---|---|---|
| [**d3 zoomable treemap**](https://api.observablehq.com/@d3/zoomable-treemap.js?v=4) | Snap only | **Camera.** Layout computed **once**; click rescales `x`/`y` domains | Parent drawn as a **30 px header strip** above the frame | Click the header. **Exact inverse** | No | 750 ms, d3 default easing; opacity cross-fade |
| [**ECharts treemap** (`zoomToNode`)](https://github.com/apache/echarts/blob/master/src/chart/treemap/treemapLayout.ts) | Snap **+** free | **Camera-equivalent.** Re-runs squarify, but on a rect *similar* to the container, so proportions are identical | Ancestors kept; `breadcrumb` (h 22, bottom-centre) | Breadcrumb, or zoom out | **Yes** — `roam: true` by default | `animationDurationUpdate`, `cubicOut`; per-rect shape tween |
| [**Highcharts treemap**](https://github.com/highcharts/highcharts/blob/master/ts/Series/Treemap/TreemapSeries.ts) | Snap only | **Camera.** Layout covers the whole tree in a fixed 0–100 data space; drilling calls `setExtremes` | Ancestors stay but are clipped out; their labels suppressed | `breadcrumbs` (since 10.0.0) | No | 500 ms (`animObject`), `easeInOutSine`; instant above `animationLimit: 250` points |
| [**FoamTree**](https://get.carrotsearch.com/foamtree/latest/api/) | Snap **+** free | **Camera.** Tessellation computed **once per data model**; `expose`/`zoom`/pan are draw-time transforms | Stacked parent polygons *are* the frame | Right-double-click unexposes; `Esc` = "rapid zoom out" | **Yes** — wheel zoom + drag pan | `exposeDuration: 700`, `squareInOut`; wheel 500 ms `squareOut` |
| [**Plotly treemap / sunburst / icicle**](https://github.com/plotly/plotly.js/blob/master/src/traces/treemap/plot_one.js) | Snap only | **LAYOUT CHANGE.** Re-tiles a *copy* of the clicked subtree at full viewport size | `pathbar` breadcrumb, **outside** the plot domain | Click pathbar crumb, or click current root | **No camera exists at all** | 750 ms, `'poly'` easing; per-rect corner interpolation |
| [**ECharts drill-down** (`leafDepth`)](https://github.com/apache/echarts-doc/blob/master/en/option/series/treemap.md) | Snap | **LAYOUT CHANGE.** `treemapRootToNode` re-roots | Breadcrumb | Breadcrumb | Yes | Same tween; departing rects fold to bottom-right |
| [**d3 zoomable sunburst**](https://api.observablehq.com/@d3/zoomable-sunburst.js?v=4) | Snap only | **Camera**, expressed per-datum as a normalised transform | Centre disc | Click centre. Exact inverse | No | 750 ms; interpolates **data-space coords** |
| [GrandPerspective](https://grandperspectiv.sourceforge.net/HelpDocumentation/NavigatingViews.html) | Snap only | **LAYOUT CHANGE** — "changes the folder that is shown in the view" | Gone | ⌘− "one level at a time" | No | Not documented |
| [WinDirStat](https://documentation.help/WinDirStat/treemap.htm) | Snap only | **LAYOUT CHANGE** — "enlarges the treemap, so that a subtree is displayed full size" | Not drawn; blue frame in the list | Zoom out (F10 pair) | No | No |
| [DaisyDisk](https://daisydiskapp.com/guide/2/en/UnderstandingSunburst/) | Snap only | **LAYOUT CHANGE** — sector becomes the new centre | Collapse to centre | Click the centre; ⌘↑; ⌘[ / ⌘] history | No | Yes (duration undocumented) |
| [SpaceSniffer](https://static.nebula-soft.com/CSEC-TOOL/Windows/SpaceSniffer/2.0.3.12/SpaceSniffer%20User%20Manual.pdf) | Snap (double-click) | **LAYOUT CHANGE** — "expand the folder to the entire view" | Gone; "viewable percent bar" | Browser-style back/forward, BACKSPACE | No | **Yes, and tunable** — see §5 |
| [WizTree](https://diskanalyzer.com/whats-new) | Snap only | **LAYOUT CHANGE** — "zoom the treemap into that folder" | Gone | `..` unzoom, `\` reset, F11 parent | No | Not documented |
| [Filelight](https://docs.kde.org/trunk_kf6/en/filelight/filelight/filelight.pdf) | Snap only | **LAYOUT CHANGE** — "re-center the map on that segment" | Collapse inward | Alt+Up, Back/Forward, breadcrumb | Separate `Ctrl++` scale | Not documented |
| [MapLibre `fitBounds`/`flyTo`/`easeTo`](https://github.com/maplibre/maplibre-gl-js/blob/main/src/ui/camera.ts) | Snap **+** free | **Camera** (geography is fixed; layout change is impossible) | N/A | `flyTo` back | **Yes**, always | van Wijk optimal path; see §7 |
| [Google Earth `gx:FlyTo`](https://developers.google.com/kml/documentation/kmlreference) | Snap + free | **Camera** | N/A | Tour steps | Yes | Author-specified `gx:duration`; algorithm closed |
| [`d3.treemapResquarify`](https://d3js.org/d3-hierarchy/treemap) | — | **Dead end for this question** — stability is across *value* changes, not zoom | — | — | — | — |
| Baobab | Snap | Reported re-root, **primary source not confirmed** | — | — | — | — |

---

## 2. The crux: camera animation or layout change?

### 2a. The four that keep layout fixed

**d3's zoomable treemap is the cleanest evidence, and it also disposes of the usual argument
for re-layout.** The layout is computed exactly once:

```js
const root = d3.treemap().tile(tile)(hierarchy);
```

and a click only moves the camera:

```js
function zoomin(d) {
  x.domain([d.x0, d.x1]);
  y.domain([d.y0, d.y1]);
  ...
}
```

The interesting part is `tile`. Bostock's own comment: *"This custom tiling function adapts the
built-in binary tiling function for the appropriate aspect ratio when the treemap is
zoomed-in."*

```js
function tile(node, x0, y0, x1, y1) {
  d3.treemapBinary(node, 0, 0, width, height);
  for (const child of node.children) {
    child.x0 = x0 + child.x0 / width * (x1 - x0);
    ...
  }
}
```

Each node's children are tiled **in the canonical full-viewport frame** and then linearly
remapped into the parent's actual rect. So every node's children already carry the aspect
ratio they will have *when that node fills the frame*. **You get a good aspect ratio at every
level without ever re-running the layout.** That is the whole reason people reach for
re-rooting, solved with eight lines and no loss of stability. This is the single most
transferable idea in the report.

**ECharts is the subtle one, and it comes out on the camera side.** It *does* call
`squarify()` on every render — `viewRoot.hostTree.clearLayouts(); ... squarify(viewRoot,
options, false, 0);` — which looks like a layout change. But look at what rect it squarifies
into. `estimateRootSize()` walks from the clicked node up to the root accumulating
`area *= sum / currNodeValue`, then:

```js
const scale = Math.pow(area / viewArea, 0.5);
return {width: containerWidth * scale, height: containerHeight * scale};
```

**Both dimensions are scaled by the same factor.** The root rect is therefore always
*similar* to the container, so squarify sees the same aspect ratio every time and returns the
same proportional layout, merely scaled. Mathematically this is a camera zoom, implemented as
a re-layout. Shapes do not change under the reader. Two further details:
`area < viewArea && (area = viewArea)` never zooms out past fit, and the estimate adds
`(3 * borderWidth + upperHeight) * Math.pow(area, 0.5)` — **it budgets for the parent label
strip when choosing the zoom target**, which ties directly to recommendation 5 of the label
report. Panning is even cheaper: `if (payloadType !== 'treemapMove')` guards the whole layout
block, so a drag does no layout at all.

**Highcharts is camera, via the axes.** `translate()` seeds from the true root
(`series.nodeMap['']`) with `{x: 0, y: 0, width: axisMax, height: axisMax}` where
`const axisMax = 100`, and recurses over the entire tree. The axes are pinned
(`treeAxisDefaults.min = 0; treeAxisDefaults.max = axisMax`). Drilling then moves the
viewport, with an explicit comment:

```js
// Update axis extremes according to the root node.
if (options.allowTraversingTree && rootNode.pointValues) {
    val = rootNode.pointValues;
    series.xAxis.setExtremes(val.x, val.x + val.width, false);
    series.yAxis.setExtremes(val.y, val.y + val.height, false);
```

`setPointValues()` then maps the invariant data-space rects through `xAxis.toPixels`. Nothing
is re-squarified. **One caveat that turns it into a layout change:** `levelIsConstant`
(default `true`) controls `levelDynamic = tree.level - (levelIsConstant ? 0 : nodeRoot.level)`.
Set it `false` and per-level options — including `layoutAlgorithm` — shift as you traverse, at
which point the geometry genuinely does change. The default avoids that.

**FoamTree is camera by architecture.** Navigation never re-tessellates; re-layout happens
only when the data model changes. The decisive line is in the `containerCoordinates` docs:
*"transformations, such as exposure, are applied on per-group basis, so the inverse coordinate
transform needs to take into account the scale and offset of the specific transformed group"*,
and `geometry` returns coordinates that are *"absolute, it does not take into account the
transformations resulting from zooming, panning and exposure."* Its four operations are
genuinely different things: `select` is cosmetic; `open` changes only what is painted and
hit-tested (*"its label and polygon are not painted so that the user can interact with its
child groups"*); `expose` is a per-group affine magnification; `zoom` is a real view camera.
`maxGroupLevelsDrawn: 4` is documented as a precompute budget — *"With a lower number of
layouts computed up-front, the initial rendering as well as group opening time should be much
lower"* — confirming layouts are precomputed, not computed on open.

### 2b. The one charting library that re-lays out

**Plotly re-tiles, unambiguously.** `plot_one.js` resolves
`entry = helpers.findEntryWithLevel(hierarchy, trace.level)`, and `findEntryWithLevel` returns
`pt.copy()` — a **detached subtree**. `draw_descendants.js` then calls
`partition(entry, [width, height], {...})` where `width`/`height` are the full trace domain,
and `partition.js` is a thin wrapper over
`d3Hierarchy.treemap().tile(getTilingMethod(opts.packing, opts.squarifyratio)).size(size)(entry)`.
So the clicked node's children are re-squarified to fill the whole frame: shapes change,
relative areas are re-normalised to the new root, and **there is no viewport transform anywhere
in the trace** — `base_plot.js` is just `plots.plotBasePlot`, with no drag layer and no axes.

### 2c. The disk tools: unanimous re-root

All seven documented tools re-root. Not one has a camera over a fixed layout. WinDirStat:
*"enlarges the treemap, so that a subtree is displayed full size."* SpaceSniffer: *"expand the
folder to the entire view, showing more smaller elements previously hidden because of their
small size."* GrandPerspective: zoom *"changes the folder that is shown in the view."*

### 2d. Which camp is larger, and why each chose

Counting things that are *interactive zoomable treemaps* — the category Atlas is in — it is
**4–1 for keeping layout fixed** (d3, ECharts' `zoomToNode`, Highcharts, FoamTree; Plotly
alone re-tiles). Counting *desktop disk browsers*, it is **7–0 for re-rooting**.

The reason for the divide is legible in what each product is for:

- **Disk tools are file browsers.** The treemap is a *view of a folder*, not a map of a disk;
  you are always "in" one directory, and the visualisation is regenerated for it exactly as a
  file listing would be. They have no camera because they never needed one. Continuity across
  the transition is not a goal — several do not even animate it.
- **Charting libraries are comparison instruments.** Their value proposition is that area
  encodes quantity, so a transition that silently re-normalises area and reshuffles rectangles
  damages the thing being sold. Hence d3's canonical-frame trick, ECharts' similar-rect scaling
  and Highcharts' invariant data space — three different implementations of the same refusal to
  move the geometry.
- **Plotly is the exception, and it looks like a consequence rather than a decision.** Its
  treemap shares machinery with sunburst and icicle, where a re-root genuinely *is* the natural
  operation (a sunburst's rings are defined relative to the current centre). Having built
  `partition(entry.copy(), size)` for those, the treemap inherited it. The tell is that Plotly
  has no camera at all: not a camera-vs-layout choice so much as a code path that made the
  question moot.
- **Map engines cannot re-lay out** — geography is fixed — so they are camera-only by nature.
  They are evidence about *animation*, not about this crux.

### 2e. Verdict on our standing constraint

**Our decision is vindicated; following the field does not mean overturning it.** The nearest
prior art to Atlas — interactive, zoomable, area-encoding treemaps — keeps the layout fixed and
moves the camera, 4 to 1, and does so deliberately, with three independent implementations of
the trick needed to make it work at every level. A snap zoom that only moves the camera
composes exactly with dim-plus-breadcrumb: clicking a plate becomes the same act as clicking
its row in the rail, differing only in that it also animates the viewport.

The one thing worth importing from the re-rooting camp is **not** its re-layout but its
aspect-ratio motivation — and d3's canonical-frame `tile` gives us that without the cost.

---

## 3. What happens to the levels above

Three conventions, and the good ones keep the parent *on screen*:

- **Parent as a header strip** — d3 draws the root as a `width × 30` bar translated to
  `(0, -30)`, i.e. a header above the frame, and clicking it zooms out. This is the same
  reserved-strip convention as recommendation 5 of the label report, doing double duty as the
  "up" affordance.
- **Parent as the surrounding frame** — FoamTree's `stacking: "hierarchical"` leaves ancestor
  polygons painted underneath (`parentFillOpacity`, `parentLabelOpacity`), so *the frame you
  are standing inside is the breadcrumb*. There is no breadcrumb widget at all.
- **Parent as a separate breadcrumb widget** — ECharts (`breadcrumb`, height 22, bottom-centre),
  Highcharts (`breadcrumbs`, replacing `traverseUpButton` since 9.3.3), Plotly (`pathbar`).
  Plotly's is instructive as a warning: `draw_ancestors.js` overwrites the crumb geometry with
  `eachWidth = width / trace._entryDepth`, so **the breadcrumb carries no area encoding
  whatsoever** — equal-width chevrons. It is a path, not a chart.

Highcharts keeps ancestors in the DOM and visible but clipped away by the plot area, and
suppresses their labels: `drawDataLabels` disables labels for non-leaf nodes at
`level <= series.nodeMap[series.rootNode].level`.

**Is out the exact inverse of in?** Only in the camera implementations.

- **d3: yes, exactly.** `zoomin(d)` sets the domain to `d`'s extent; `zoomout(d)` sets it to
  `d.parent`'s. Same function, same 750 ms, opposite cross-fade.
- **FoamTree: yes** — right-double-click unexposes, `expose([])` unexposes all, and each
  operation returns a promise so they sequence rather than race.
- **Highcharts: no.** The breadcrumb `up` handler computes
  `drillUpsNumber = this.level - e.newLevel` and loops `series.drillUp()`, so jumping up three
  levels fires three `setRootNode` calls and three redraws.
- **Plotly: no.** In and out are mirror-image *heuristics*: `findClosestEdge` snaps a new
  rect's edges to `0`/`size` so children appear to grow out of the clicked rect, while
  `makeExitSliceInterpolator` targets the entry node's previous position so departing rects
  collapse into it. Two separate approximations, not one reversible transform.
- **GrandPerspective: no, and interestingly so.** Zoom is modal and gated on selection —
  *"Clicking inside the view locks the selection"* — and then ⌘+ *"descend[s] into the first
  subfolder on the path to the selected file"*, one level per press. It walks the path rather
  than jumping to the clicked rectangle.

---

## 4. Does free zoom survive alongside the snap?

**Yes, in the two libraries that offer both, and they do not fight — because a snap is just an
animated write to the same camera state.** There is no arbitration layer anywhere in the field,
and in particular **no library implements "free zoom past a threshold commits to a level."** I
looked for it specifically and found nothing of the kind.

- **ECharts**: `roam` defaults to **`true`** (both zoom and pan), alongside `nodeClick`
  defaulting to `'zoomToNode'`. Both funnel into the same scale/offset state;
  `treemapClampZoom` and `scaleLimit {min, max}` bound it. Free pan (`treemapMove`) skips
  layout entirely.
- **FoamTree**: wheel zoom (`zoomMouseWheelFactor: 1.5`) and drag pan coexist with `expose`.
  They *compose* rather than conflict because they are transforms at different scopes —
  view-wide versus per-group — which is exactly why the inverse-coordinate helper must be told
  which group a point belongs to. Gestures self-correct: `dragend` and `transformend` *"correct
  the view port in such a way that the edge of the visualization touches the edge of the
  viewport"*, and `Esc` is a documented *"rapid zoom out"* escape.
- **d3, Highcharts, Plotly**: snap only, no free zoom. Nothing to reconcile.

The re-entrancy guards are cruder than the concept: Plotly's is literally
`if (gd._transitioning) return;` — *"skip during transitions, to avoid potential bugs."*
FoamTree's promise-returning operations are the only principled sequencing in the survey.

---

## 5. The animation

**Durations cluster tightly at 500–750 ms.**

| System | Duration | Easing | What is interpolated |
|---|---|---|---|
| d3 treemap | **750 ms** | d3 transition default (cubic-in-out) | Rect attrs recomputed under the new domain, + opacity cross-fade |
| d3 sunburst | **750 ms** (7500 with Alt — debug slow-mo) | default | **Data-space coords** `d.current → d.target` |
| Plotly | **750 ms** (`CLICK_TRANSITION_TIME`) | `'poly'` (sunburst: `'linear'`) | Per-rect `{x0,x1,y0,y1}`; text `{scale, rotate, textX, textY, …}` |
| ECharts | `animationDurationUpdate` | **`cubicOut`** | Per-rect `shape {x,y,width,height}`, group `x/y`, opacity |
| Highcharts | **500 ms** (`animObject`), 400 ms fallback | `easeInOutSine` | Four geometry attrs per rect; **instant above 250 points** |
| FoamTree | **700 ms** expose, 500 ms wheel | `squareInOut` / `squareOut` | Per-group scale + offset |
| MapLibre `easeTo` | **500 ms** | `bezier(0.25, 0.1, 0.25, 1)` — CSS `ease` | Centre, zoom, bearing, pitch |
| MapLibre `flyTo` | **derived** (§7) | same | van Wijk path |

**On what to interpolate, the coordinator's premise needs one correction.** The claim that
Bostock interpolates scale *domains* rather than pixel rects is true of the **zoomable
sunburst/icicle**, not of the zoomable treemap. The treemap sets the domains *before* the
transition and then lets d3 interpolate the resulting attribute strings — so the endpoints are
computed by one `position()` function under two domains. That works only because the domain
change is a similarity shared by every rect, which makes per-rect linear interpolation exactly
equal to the global affine interpolation. No gaps or overlaps can open up. **If the transform
were not a similarity — as in a re-layout — per-rect interpolation would be the only option,
and it is why Plotly needs `findClosestEdge` heuristics to invent plausible origins.**

The sunburst *does* interpolate data-space state, and Bostock documents why, and it is not the
reason one would guess:

```js
// Transition the data on all arcs, even the ones that aren’t visible,
// so that if this transition is interrupted, entering arcs will start
// the next transition from the desired position.
path.transition(t).tween("data", d => {
  const i = d3.interpolate(d.current, d.target);
  return t => d.current = i(t);
})
```

**The reason is interruptibility.** Interpolated state is stored back onto the datum, so a
second click mid-flight starts from where things actually are rather than snapping. This is the
same principle as MapLibre's `crossTileID` in the label report — stable per-object state across
recomputation — applied to geometry. It is the detail I would most want to copy.

**The one tool that states an intent for the animation** is SpaceSniffer, whose config exposes
"Zoom animation duration" described as *"useful to make it clear where you are heading when
digging into folders"* — the animation as an orientation aid, not decoration. Worth noting that
the tool which re-roots hardest is also the one that felt obliged to explain its animation.

---

## 6. How snapping interacts with labels

**Snapping helps a great deal, and the mechanism is not the one the brief guessed.** The win is
not "we can predict which surfaces will be large" — it is that **snapping bounds the candidate
set and gives the size predicate a single well-defined moment to run.**

d3's zoomable treemap renders `root.children.concat(root)` — **one level at a time, plus the
parent header.** That is typically 10–50 rectangles of comparable size, every one of them large
enough to name. Collision detection becomes nearly vacuous; there is no scarcity to arbitrate.
ECharts reaches the same place from the other side with `leafDepth`: *"represents how many
levels are shown at most. For example, when `leafDepth` is set to `1`, only one level will be
shown."*

**And d3's zoomable sunburst is the direct precedent for exploiting the snap.** On click it
computes, for **every** node, a `target` state normalised so the clicked node fills the extent,
then decides visibility against that target:

```js
function arcVisible(d)   { return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0; }
function labelVisible(d) { return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03; }
```

Two things to read off this. `arcVisible` is a **depth window** — only two rings below the
current root are drawn. And `labelVisible` adds an **area threshold in normalised space**
(`> 0.03`), which is exactly the `visibleMin` idea from the label report; because the transform
maps the root to the full extent, normalised area is proportional to screen area. Both are
evaluated against `d.target`, i.e. **once per snap, not per frame**, and the label's
`fill-opacity` then transitions over the same 750 ms as the geometry.

So the honest answer is: **snapping does not move the labelling problem, it shrinks it.** The
per-frame decision becomes a per-snap decision; the candidate set collapses from "every
qualifying file in the tree" to "the children of one node"; and the label fade rides the
geometry transition for free. Two named systems already exploit exactly this.

The residual problem is unchanged: free zoom, if we keep it, still needs the per-frame
machinery. And ECharts' `estimateRootSize` is a reminder that the two layers interact in the
other direction too — it budgets `upperHeight` (the parent label strip) into the zoom target,
so the label layout influences where the camera lands.

---

## 7. The map-world analogue

**`fitBounds` is the "zoom to feature" primitive, and it is two steps.** `cameraForBounds`
converts a bounding box plus padding into a `{center, zoom}`; `_fitInternal` then dispatches:

```js
return options.linear ?
    this.easeTo(options, eventData) :
    this.flyTo(options, eventData);
```

Padding is first-class (`{top, bottom, left, right}` or a scalar) and is consumed by the
camera solve, then deleted — *"calculatedOptions already accounts for padding by setting zoom
and center accordingly."* **The camera is fitted to the box plus a margin, never to the box
itself.**

**`flyTo` is van Wijk & Nuij (2003) implemented literally** — `rho`, `w0`, `w1`, `u1`,
`cosh`/`sinh`/`tanh`, and duration derived from path length:

```js
const V = 'screenSpeed' in options ? +options.screenSpeed / rho : +options.speed;
options.duration = 1000 * S / V;
```

where `S` is the path length in ρ-screenfulls. Defaults `speed: 1.2`, `curve: 1.42`, and the
docs cite the paper for the constant: *"1.42 is the average value selected by participants in
the user study discussed in [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf)."*
`speed: 1.2` means *"the map appears to move along the flight path by 1.2 times `options.curve`
screenfulls every second."* One pragmatic rule worth stealing: if the computed duration exceeds
`maxDuration`, **it is set to 0** — i.e. give up and jump rather than subject the reader to a
very long flight.

**What van Wijk optimises is not screen distance but *optical flow*** — perceived visual
motion. Reach & North describe it as *"a cost-minimizing zooming and panning animation… found
via methods from differential geometry"*, with ρ controlling *"the trade-off between zooming and
panning"*, V controlling traversal speed, an *"elliptical trajectory, where the eccentricity of
the ellipse is determined by the parameter ρ"*, and the consequence that the camera **zooms out
first**: *"an animation that first zooms out from Seattle, then pans, then zooms into London is
perceptually cheaper."* Duration is *"proportional to the distance between the start point and
the target point"* in the pan-zoom metric. MapLibre states the arc as an implementation fact via
`minZoom`: *"The animation will not zoom out beyond this level. If the natural flight arc stays
within this boundary, the arc is unchanged."*
*(The paper's own PDF returned 503 on every attempt, so the quotations above are from Reach &
North and the MapLibre docs, not the paper itself.)*

**Google Earth documents only the authoring contract.** `<gx:FlyTo>` takes an AbstractView plus
`<gx:duration>` — *"the time in seconds"* the browser takes — which is **author-specified and
not derived from distance**. `<gx:flyToMode>` picks `bounce` (default: transitions *"begin and
end at zero velocity"*) or `smooth` (velocity carried across consecutive flights, *"interpolating
the velocity and a curved path between points so that each placemark is reached at exactly the
time specified"*). The widely-observed arc-up-and-back-down trajectory is **not documented**,
and the interpolation algorithm and default flight speed are closed.

---

## 8. Recommendation

**Snap and free, both. Camera-only. Do not re-run the layout.**

1. **Snap on plate click, camera-only.** Animate the viewport onto the plate's rectangle over
   an unchanged layout. This is what d3, ECharts' `zoomToNode`, Highcharts and FoamTree all do,
   and it is what preserves the area encoding that is the point of a treemap. It also means
   clicking a plate and clicking its row in the rail are **the same action** — set scope, dim
   what is out of scope, push a breadcrumb — with the plate click additionally animating the
   camera. Our existing decision stands unamended.

2. **Adopt d3's canonical-frame tiling now, before anything else.** Tile each node's children
   in a full-viewport reference frame and remap into the parent's rect. Eight lines. This is
   the only thing the re-rooting camp actually buys — a good aspect ratio at every depth — and
   this gets it with zero cost to stability. Without it, deep plates look like slivers when you
   snap to them and the case for re-rooting will keep coming back.

3. **Do not fill the viewport. Leave a margin.** Every system that snaps well leaves context:
   ECharts' `zoomToNodeRatio` defaults to `0.32 * 0.32` — the node occupies ~10% of the view
   *area*, ~32% of each linear dimension — and FoamTree's `groupExposureZoomMargin: 0.1` is
   documented as *"If `groupExposureZoomMargin` is 0, the exposed group will occupy the full
   height / width of the view port"*, i.e. 0 is the degenerate case you configure away from.
   MapLibre's `fitBounds` takes padding as a first-class argument. I would target ~90% linear
   fill so the parent frame and its header strip stay visible — which also keeps the breadcrumb
   honest, because you can still *see* the thing the breadcrumb names.

4. **Keep free zoom, and do not arbitrate between the two.** A snap is an animated write to the
   same camera state that the wheel writes directly. They cannot fight. Bound both with a
   single clamp (ECharts' `scaleLimit {min, max}` / `treemapClampZoom`). **Do not build
   "free zoom past a threshold commits to a level"** — no library in the survey does that, and
   it would make the camera's behaviour depend on how you arrived, which is exactly the
   history-dependence that Been/Daiches/Yap's D4 warns against.

5. **Animate ~500 ms, ease-out, and interpolate the camera — not the rectangles.** The field
   clusters at 500–750 ms; since our hops are short and repeated, take the low end (Highcharts'
   500 ms, MapLibre's `easeTo` 500 ms with CSS `ease`). Because the transform is a similarity,
   interpolating a single `{scale, translate}` is both correct and far cheaper than tweening
   thousands of rects. Skip van Wijk's arc: it earns its complexity when the camera crosses
   many screenfulls, which a treemap snap does not.

6. **Make it interruptible, and store the interpolated camera state.** Bostock's documented
   reason — *"so that if this transition is interrupted, entering arcs will start the next
   transition from the desired position"* — applies directly: a second plate click mid-flight
   must retarget from the current camera, not snap. This is cheap and it is the difference
   between a snap that feels solid and one that feels brittle.

7. **Out is the exact inverse of in.** One function, one duration, opposite direction, as d3
   and FoamTree do. Avoid Highcharts' N-redraws-for-N-levels and Plotly's mirror-image
   heuristics. A breadcrumb jump of three levels should be one animation to one camera state.
   Keep an escape hatch — FoamTree's `Esc` = *"rapid zoom out"* — and make it reset to fit.

### Effect on the eight label recommendations

**No reordering of items 1–5.** Those are preconditions (separating
eligibility/priority/opacity; clipping and eliding; the size predicate; the collision grid; the
header strips) and snapping neither helps nor hinders them. Items 1 and 2 in particular remain
the urgent ones — a snap zoom onto plates whose labels still go out in paint order and still
overflow their cells would just deliver the wrong labels more smoothly.

Three things do change, all in the direction of less work:

- **Item 6 (move-only-on-settle) gets easier and stronger.** With a snap, "settle" is an exact
  event — the transition's completion — not a heuristic camera-idle guess. Implement it as
  *re-place on snap completion, and on camera idle for free zoom.* This is now the cheapest
  high-value item after 1–3.
- **Item 3's predicate should be evaluated against the target camera, once per snap**, exactly
  as d3's `labelVisible(d.target)` does, with the label opacity riding the same transition.
  That is a small change to where the predicate is called, not to what it computes.
- **Item 7 (the 300 ms placement throttle and opacity state machine) may become unnecessary,
  and item 9 (precomputed active ranges) recedes further.** Both exist to tame *continuous*
  zoom. If snapping becomes the dominant way people move — which it should, given the rail
  already works this way — the continuous-zoom surface shrinks to a secondary gesture. Build
  item 6, measure, and only then decide whether 7 is still needed. I would now put item 9
  firmly behind a "we tried everything else" gate.

One addition to the label order, small and worth it: **consider drawing a depth window rather
than the whole tree** — d3's `arcVisible` shows two levels below the root; ECharts' `leafDepth:
1` shows one. Combined with snapping, this is what collapses the label candidate set from
hundreds to tens and makes the collision grid nearly idle. It is a rendering decision with a
large labelling payoff.

---

## 9. Gaps

- **`d3.treemapResquarify` is not what the brief supposed.** Its stability is with respect to
  **changing values**, not zooming: *"preserves the topology (node adjacencies) of the previous
  layout… good for animating changes to treemaps because it only changes node sizes and not
  their relative positions."* It also carries a documented cost — *"The downside of a stable
  update, however, is a suboptimal layout for subsequent updates: only the first layout uses
  the Bruls et al. squarified algorithm."* d3's zoomable treemap does not use it; it uses
  `treemapBinary` through the custom tile.
- **The van Wijk & Nuij paper itself was unreachable** (503 from
  `vanwijk.win.tue.nl/zoompan.pdf` on every attempt). Its substance here comes from Reach &
  North's description and MapLibre's docs and source, not the primary text.
- **Google Earth's flight algorithm is closed.** Duration is author-specified, not
  distance-derived, and the arc-up trajectory is undocumented. Do not model on it.
- **Highcharts' breadcrumb animation defaults** were not chased into `Breadcrumbs.ts`.
- **FoamTree has no explicit "mental map" or layout-stability statement.** The property is
  strongly implied by the architecture and by the `geometry`/`containerCoordinates` wording, but
  Carrot Search never argues for it as a principle — so it is evidence of practice, not of
  stated intent. FoamTree is also closed source; the defaults above come from the API reference
  and the shipped bundle.
- **Some disk-tool details are mirrored or unconfirmed.** The verbatim WinDirStat help text came
  via `documentation.help`, which is a third-party mirror. Whether GrandPerspective, WinDirStat
  or WizTree animate their transitions at all is **not documented**. **Baobab** is
  secondary-sourced only.
- **No library implements "free zoom commits to a level."** I searched for it specifically. Its
  absence is the finding — treat any proposal to build one as unprecedented, not as catching up.
- **No published study compares snap against free zoom** for treemaps on comprehension or
  orientation, and I did not find one. The 4–1 split is engineering practice, not evidence of
  what readers prefer.
