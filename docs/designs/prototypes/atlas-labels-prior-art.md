# Atlas label layer: how the field actually does this

Research report. Prior art for labelling a continuously zoomable 2D nested treemap and a 3D
code city, both canvas-drawn, from shipping systems rather than from first principles.

Sources are primary wherever possible: library source code, official docs, engineering
write-ups by the people who built the thing, and papers read directly. Every substantive
claim carries a URL. Where I could not find an answer, it says so — see **Gaps** at the end.

---

## 1. Inventory

One row per system. Highest-value first; dead ends marked as such and kept, so nobody
re-treads them.

| System | What it renders | Labelling technique | Good source for us? | Link |
|---|---|---|---|---|
| **MapLibre GL JS** | GPU vector tiles, continuous zoom/pitch/rotate | Uniform-grid collision index in viewport space; greedy placement in sort-key order; 3-pass sticky anchors; per-symbol opacity state machine; cross-tile identity | **Yes — the single best source** | [placement.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/placement.ts), [collision_index.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/collision_index.ts), [grid_index.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/grid_index.ts), [pauseable_placement.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/style/pauseable_placement.ts), [cross_tile_symbol_index.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/cross_tile_symbol_index.ts) |
| **Mapbox GL** (same lineage) | " | Design write-up and rationale for the above | Yes, for the "why" | [Text Rendering wiki](https://github.com/mapbox/mapbox-gl-native/wiki/Text-Rendering), [PR #5150](https://github.com/mapbox/mapbox-gl-js/pull/5150), [issue #4704](https://github.com/mapbox/mapbox-gl-js/issues/4704) |
| **Been, Daiches & Yap, _Dynamic Map Labeling_** (InfoVis 2006) | Theory, with a shipped demo | **Active ranges**: place and select in preprocessing as a function of scale; runtime is an interval test. Formalises **monotonicity** as desideratum D1 | **Yes — the paper for our exact bug** | [PDF](https://cs.nyu.edu/~visual/home/pub/infovis06.pdf) |
| **ECharts treemap** | 2D nested treemap | `visibleMin` (10 px² screen-area gate), `childrenVisibleMin`, `upperLabel` = **reserved inner-top strip for parents**, `overflow: truncate\|break\|breakAll` | **Yes — header-strip + area-gate precedent** | [treemap.md](https://github.com/apache/echarts-doc/blob/master/en/option/series/treemap.md) |
| **Lehmann, Trapp & Döllner** (GeoViz 2011) | **3D treemaps** of software systems | Top-face-only placement; text scaled non-uniformly to node diagonal; tilt interpolated by camera angle; **labels move only after the camera stops** | **Yes — the 3D-city paper we actually wanted** | [PDF](https://hpi.de/fileadmin/user_upload/fachgebiete/doellner/publications/2011/LTD2011/clehmann_geoviz2011.pdf) |
| **CodeCharta** | **A 3D code city** — our data pipeline | Folders = **baked ground decals**; files = DOM **billboards**, top-N by rendered height, union-find screen-rect groups, one winner + count badge, **leader lines** with a displacement cap | **Yes — closest prior art** | [floorLabelDrawer.ts](https://github.com/MaibornWolff/codecharta/blob/main/visualization/app/codeCharta/renderer/threeViewer/floorLabels/floorLabelDrawer.ts), [connectorDrawing.service.ts](https://github.com/MaibornWolff/codecharta/blob/main/visualization/app/codeCharta/features/labelSettings/services/connectorDrawing.service.ts) |
| **Lü & Fogarty, _Cascaded Treemaps_** (GI 2008) | 2D nested treemaps | Names the design class **"labeled treemaps"**; documents the header convention **and quantifies its area distortion** | **Yes — the citation for the header strip** | [PDF](https://homes.cs.washington.edu/~jfogarty/publications/gi2008.pdf), [ACM](https://dl.acm.org/doi/10.5555/1375714.1375758) |
| **ArcGIS Maplex** | Static cartography, offline solver | Priority ranking + label/feature **weights (0–1000)**; then a **fitting-strategy ladder** down to abbreviation and truncation | **Goldmine for priority + truncation** | [weights](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/text/weight-labels-and-features.html), [abbreviate/truncate](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/text/abbreviate-and-truncate-labels.html) |
| **deck.gl `CollisionFilterExtension`** | Any layer incl. text | **GPU collision map**: ids into an offscreen FBO with priority baked into clip z; instances sample a 5×5 neighbourhood and fade by matched fraction | **Yes — most copyable GPU trick** | [collision-filter-effect.ts](https://github.com/visgl/deck.gl/blob/master/modules/extensions/src/collision-filter/collision-filter-effect.ts) |
| **Mapnik / OSM Carto engine** | Server-side raster, one static zoom | 4 swappable quadtree collision detectors; **ordered fallback chains over position _and_ font size** | **Yes — the fallback-chain idea** | [label_collision_detector.hpp](https://github.com/mapnik/mapnik/blob/master/include/mapnik/label_collision_detector.hpp), [simple.cpp](https://github.com/mapnik/mapnik/blob/master/src/text/placements/simple.cpp) |
| **OSM Carto style** | Authored style over Mapnik | Zoom windows + population score + `way_pixels` area gates; per-zoom size/wrap/margin ramps | Yes — real authoring practice | [placenames.mss](https://github.com/gravitystorm/openstreetmap-carto/blob/master/style/placenames.mss) |
| **CesiumJS** | 3D globe + tiled buildings | Billboards; **manual depth test in the fragment shader**; 3-point key-point test; `scaleByDistance` / `translucencyByDistance` / `distanceDisplayCondition` ramps | **Yes — for occlusion only** | [BillboardCollectionFS.glsl](https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Shaders/BillboardCollectionFS.glsl) |
| **Tangram / Tilezen** | GPU vector tiles | `priority` (lower wins), `repeat_group` + `repeat_distance`, ordered `anchor` array, `text_wrap` + `max_lines` ellipsis | Yes — cheap, legible model | [draw reference](https://tangrams.readthedocs.io/en/latest/Syntax-Reference/draw/) |
| **polylabel** (Mapbox) | Polygon label anchor | Pole of inaccessibility via priority-queue grid subdivision; **handles holes** (verified in source) | Yes — for parent-minus-children | [repo](https://github.com/mapbox/polylabel), [polylabel.js](https://github.com/mapbox/polylabel/blob/master/polylabel.js) |
| **FoamTree (Carrot Search)** | Voronoi treemap | Fits labels to the **largest inscribed rectangle** of the polygon; shrink-to-fit between `groupLabelMinFontSize`/`MaxFontSize`; multi-line wrap; `maxGroupLabelLevelsDrawn`; `wireframeLabelDrawing` drops labels during animation | Yes, but **docs-level only** (closed source) | [API reference](https://get.carrotsearch.com/foamtree/demo/api/index.html) |
| **d3-hierarchy treemap** | 2D treemap layout only | **No label support at all.** `paddingTop` "separate the top edge of a node from its children" is the header mechanism; `treemapResquarify` preserves topology for animation | Partial — mechanism, not policy | [d3-hierarchy/treemap](https://d3js.org/d3-hierarchy/treemap) |
| **Fekete & Plaisant, _Million Items_** (InfoVis 2002) | Dense treemap, 1M items | Excentric labelling **extended to treemaps** — labels drawn _outside_ a greyed focus region; explicitly rejects static labelling at density | Yes — the dense-regime answer | [TR 2002-01](https://www.cs.umd.edu/hcil/trs/2002-01/2002-01.pdf) |
| **Excentric labelling** (Fekete & Plaisant, CHI 1999) | Focus+context | Label only a cursor neighbourhood into a fan of leader lines | Yes — the too-dense escape hatch | [CHI paper](https://www.cs.umd.edu/hcil/trs/98-09/98-09.pdf), [HCIL project](http://www.cs.umd.edu/projects/hcil/excentric/) |
| **Wagner & Wolff, _Three Rules Suffice_** | Theory | 3 conflict-graph reductions that provably keep optimality; matches annealing at 30–100× the speed | Yes — if we ever want quality | [PDF](https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/wwks-3rsgl-01.pdf) |
| **Christensen, Marks & Shieber** (1995) | Theory + empirics | The time/quality **staircase**; 8-position ranked candidate model; greedy 79 LOC vs annealing 239 | Yes, briefly | [MERL TR94-12](https://merl.com/publications/docs/TR94-12.pdf) |
| **Turo & Johnson** (IEEE Vis 1992) | Earliest treemap labels | _"Textual Signposts"_ — upper-left corner, **size-gated**, landmark-oriented | Yes, briefly | [HCIL TR 92-06](http://www.cs.umd.edu/hcil/trs/92-06/92-06.pdf) |
| **Highcharts treemap** | 2D treemap | `dataLabels.allowOverlap: false` → collision avoidance **hides** overlappers; `levels.dataLabels` per depth | Weak | [allowOverlap](https://api.highcharts.com/highcharts/series.treemap.dataLabels.allowOverlap), [levelIsConstant](https://api.highcharts.com/highcharts/series.treemap.levelIsConstant) |
| **Google Maps** | Closed | Patents only: deterministic per-tile sort; **"crawling"** named as a defect, fixed by deterministic recursive bisection so anchors are a function of the feature, not the viewport | Weak, but the patents are real | [US8237745](https://patents.google.com/patent/US8237745), [US11461945B2](https://patents.google.com/patent/US11461945B2/en) |
| **Bell, Feiner & Höllerer** — view management | AR/VR | Greedy screen-space rectangle allocation; internal vs external labels | Marginal | [paper](https://graphics.cs.columbia.edu/publications/bell-2001-view.pdf) |
| **Maass & Döllner** (Smart Graphics 2006) | Virtual landscapes | Antecedent to Lehmann et al.; dynamic annotation placement with view management | Marginal | [Springer](https://link.springer.com/chapter/10.1007/11795018_1) |
| **Floating Labels** (Rostock) | Interactive labelling | Leave the algorithm alone; spread each change smoothly over several frames | Marginal — one idea | [PDF](https://vca.informatik.uni-rostock.de/~schumann/papers/2008+/floating_labels.pdf) |
| **Code Park** (VISSOFT 2017) | 3D code city | Districts labelled by directory name; leaves hover-only | Marginal | [arXiv](https://arxiv.org/pdf/1708.02174) |
| **Cesium declutter / `EntityCluster`** | — | **Dead end.** Merges by `pixelRange`; real declutter open ~12 years | No | [#1097](https://github.com/CesiumGS/cesium/issues/1097) |
| **Leaflet** | DOM/canvas overlays | **Dead end.** No collision in core; maintainers declined it. Plugins hide by declaration order or `weight` | No | [#5104](https://github.com/Leaflet/Leaflet/issues/5104) |
| **WinDirStat / GrandPerspective / DaisyDisk** | Disk treemaps | **DEAD END — a named lead that went nowhere. They essentially do not label cells at all.** The name goes to a status-bar readout on hover, or to a sidebar list. There is no in-place labelling policy to learn from | No | [GrandPerspective views](https://grandperspectiv.sourceforge.net/HelpDocumentation/Views.html) |
| **CodeCity** (Wettel) | Classes as buildings | **DEAD END — a named lead that went nowhere, confirmed by full-text search.** "label" appears **zero times** in the 133-page thesis; likewise "billboard", "3D text", "legibility". Names come from hover + side panels. Even the ICPC paper identifies buildings with numbered callouts resolved in a caption table — on paper the authors could not put the name on the building either | No | [thesis](https://wettel.github.io/download/Wettel10b-PhDThesis.pdf), [ICPC 2007](https://wettel.github.io/download/Wettel07a-icpc.pdf), [VISSOFT 2007](https://wettel.github.io/download/Wettel07b-vissoft.pdf) |
| **"Kirkpatrick-style nested labelling"** | — | **DEAD END — a named lead that went nowhere. I could not find that this exists.** No treemap-labelling work under that name; Kirkpatrick's published work is point location / hierarchical triangulation. I believe the name is a misremembering | No | — |
| **Squarified Treemaps** (Bruls et al. 2000) | — | **Dead end, and instructive: mentions labels zero times.** Its four arguments for squareness are border pixels, detectability, size comparison, accuracy. _The label argument for squarified layouts is retrofitted by later authors, ourselves included_ | No | [PDF](https://www.win.tue.nl/~vanwijk/stm.pdf) |
| **Ordered / Quantum Treemaps** (Shneiderman, Wattenberg, Bederson) | — | **Dead end for labels.** Two passing mentions: "poor visibility and awkward labeling" | No (but stops a search) | [Ordered Treemap Layouts](https://www.cs.umd.edu/~ben/papers/Shneiderman2001Ordered.pdf), [Ordered and Quantum](http://www.cs.umd.edu/~ben/papers/Bederson2002Ordered.pdf) |
| **Google Earth** | 3D globe | **Dead end.** KML gives `<extrude>` tethers; no published placement or declutter algorithm | No | [KML reference](https://developers.google.com/kml/documentation/kmlreference) |
| **Plotly treemap** | 2D treemap | **Not examined — gap** | Unknown | — |

---

## 2. The seven questions

### Q1. How does a mature system decide *how many* labels to show at a given zoom?

**Almost nobody uses a fixed budget.** Three real techniques.

**(a) Minimum feature size in screen pixels — the dominant answer, and closest to our
problem.** ECharts has it exactly: `visibleMin`, default **10 px²** — "A node will not be
shown when its area size is smaller than this value (unit: px square)… When user zoom the
treemap, the area size will increase and the rectangle will be shown if the area size is
larger than this threshold"
([treemap.md](https://github.com/apache/echarts-doc/blob/master/en/option/series/treemap.md)).
Its sibling `childrenVisibleMin` gates whether a node's *children* are drawn at all. The map
world gates on area too: OSM Carto's `#country-names` requires `[way_pixels > 1000]`
([placenames.mss](https://github.com/gravitystorm/openstreetmap-carto/blob/master/style/placenames.mss));
Tangram's `placement_min_length_ratio` "prevents points from rendering on segments smaller
than the point itself"
([draw reference](https://tangrams.readthedocs.io/en/latest/Syntax-Reference/draw/));
Mapnik has `minimum-path-length`; Maplex has "minimum size of features to be labeled".
Turo & Johnson had it in 1992: labels "if space is available", and "Nodes that are large
enough to provide textual signposts are useful as landmarks in a sea of boxes"
([TR 92-06](http://www.cs.umd.edu/hcil/trs/92-06/92-06.pdf)).

**(b) As many as fit, greedily, in priority order.** MapLibre, Tangram, Mapnik and deck.gl
all do this — no target count, the collision index decides. MapLibre's index is a plain
uniform bucket grid: `new GridIndex(width + 200, height + 200, 25)`, i.e. **25 px cells**
over the viewport plus 100 px padding per side
([collision_index.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/collision_index.ts),
[grid_index.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/grid_index.ts)).
Not a quadtree, not an R-tree — a flat array of arrays with `seenUids` dedup and an
early-exit `hitTest`. Mapbox's own wiki says 30 px; the shipped MapLibre constant is 25.
That is ~200 lines and is the whole spatial story.

**(c) Spacing as a density dial, independent of typography.** `text-padding` (default 2 px)
inflates only the collision box. Mapnik splits this into `margin` ("no other label within
m px") and `repeat-distance` ("no label *with the same text* within r px") as genuinely
different queries. Tangram's `repeat_distance` defaults to 256 px within a `repeat_group`.
Maplex adds a label buffer plus "remove duplicates within fixed distance".

**Fixed top-N budgets appear in exactly one place: code cities.** CodeCharta's
`amountOfTopLabels` (0–50, `0` = off) ranks by *rendered height* rather than raw metric —
their own comment notes that with inverted height the tallest buildings are not the highest
values. This is the weakest technique in the survey and it is the one our nearest neighbour
chose, probably because it is easy rather than because it is good.

### Q2. What is the priority function?

Priority in every GPU renderer is **just the sort order into a greedy pass** — placement is
first-come-first-served, so ranking *is* prioritising.

- **MapLibre**: `symbol-sort-key`, with the sign flip documented — "Features with lower sort
  keys are drawn and placed first. When `icon-allow-overlap` or `text-allow-overlap` is
  `false`, features with a lower sort key will have priority during placement. When… set to
  `true`, features with a higher sort key will overlap over features with a lower sort key"
  ([style spec](https://github.com/maplibre/maplibre-style-spec/blob/main/src/reference/v8.json)).
  A second layer of priority is undocumented in prose: `PauseablePlacement` starts at
  `_currentPlacementIndex = order.length - 1` and decrements, so **layers are placed
  top-of-style-first**
  ([pauseable_placement.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/style/pauseable_placement.ts)).
- **Two orthogonal bits worth stealing.** `text-allow-overlap` removes a symbol from the
  *query* side ("am I blocked?"); `text-ignore-placement` removes it from the *insert* side
  ("do I block?"). Separating those two questions is genuinely good design. `text-optional`
  then decouples a text+icon pair that is otherwise atomic.
- **Collision *groups*** are a predicate on the grid query
  (`key.collisionGroupID === nextGroupID`), so two classes of label can be made not to
  compete at all
  ([placement.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/placement.ts)).
- **ArcGIS Maplex is the only system with a real cost function**, and it separates three
  things everyone else conflates: *label priority* ranks classes; *label weight* rates a
  placed label in a conflict; *feature weight* rates a feature as an obstacle, where
  "0 indicates that the feature should be treated as available space, while a weight of
  1,000 indicates that the feature is considered an obstacle". Two consequences: "Features
  with feature weights are always passed to the label engine as barriers, **even if they are
  not labeled**", and when overlap is unavoidable "a location with the lowest total feature
  weight is chosen" — cost minimisation, not a boolean
  ([weights](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/text/weight-labels-and-features.html)).
- **deck.gl** smuggles priority into geometry: `position.z = -0.001 * collisionPriority *
  position.w`, priority −1000…1000, so the ordinary depth test resolves the whole contest
  with no sort and no CPU pass
  ([collision-filter-effect.ts](https://github.com/visgl/deck.gl/blob/master/modules/extensions/src/collision-filter/collision-filter-effect.ts)).
- **CodeCharta** breaks ties **by file path** — deterministic, and that determinism is what
  keeps the winner stable frame to frame.
- **Tangram**: `priority`, lower wins. **labelgun**: `weight`, higher wins. **Leaflet
  plugins**: declaration order.

For nested rectangles nobody publishes a priority function, because nobody publishes treemap
labelling at all. The natural one falls out of the structure: **shallower depth first, then
larger screen area**.

### Q3. How is flicker/hysteresis actually implemented?

MapLibre stacks five separable mechanisms
([placement.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/placement.ts),
[style.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/style/style.ts)).

**(a) Placement is throttled, not per-frame.** `stillRecent()` returns
`this.commitTime + this.fadeDuration * durationAdjustment > now`, and
`Style._updatePlacement` gates on it. With `fadeDuration` defaulting to **300 ms**,
collision detection runs at most ~3×/second. **A one-pixel camera move cannot re-run
placement.** The pathological case has a correction:
`zoomAdjustment = Math.max(0, (this.transform.zoom - zoom) / 1.5)`, commented "When zooming
out quickly, labels can overlap each other. This adjustment is used to reduce the interval
between placement calculations and to reduce the fade duration when zooming out quickly."

**(b) Collisions gate an opacity, never geometry.** `OpacityState` holds `{opacity, placed}`
and steps `opacity = clamp(prev.opacity + (prev.placed ? +increment : -increment), 0, 1)`
where `increment = (now - commitTime) / fadeDuration`. A label is only gone when
`opacity === 0 && !placed`. `commit()` **carries forward labels that are no longer placed
but haven't finished fading**, so nothing pops.

**(c) Stable identity across recomputations** — the piece people miss. Fading is keyed to
collision time, not zoom, so the system must know that a symbol in a new tile is "the same
label" as one already fading. `CrossTileSymbolIndex` matches on `symbolInstance.key` (the
text) plus a quantised anchor position (`roundingFactor = 512 / EXTENT / 2`) within a
zoom-dependent tolerance, and hands over the existing `crossTileID` so opacity state is
inherited rather than restarted
([cross_tile_symbol_index.ts](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/cross_tile_symbol_index.ts)).

**(d) Anchor stickiness — a 3-pass loop.** `placeBoxForVariableAnchors` runs up to three
passes: if the label was placed last time, **pass 0 tries only last frame's anchor**
(`if (prevAnchor && textAnchorOffset.textAnchor !== prevAnchor) continue;`), then pass 1
tries all anchors in order, then pass 2 retries with the looser overlap mode. If nothing
places, the previous offset is *retained* — "If we didn't get placed, we still need to copy
our position from the last placement for fade animations" — so the fade-out happens where
the label was, not from a jump.

**(e) A frame budget.** Placement is resumable with a hard 2 ms slice
(`(now() - startTime) > 2`), and a partial placement is rendered rather than blocking.

**Cheaper than all of it:** Lehmann/Trapp/Döllner's rule for 3D treemaps — *"labels only
move to new positions after the camera [stops]."* Freeze positions during motion; re-place
on settle
([PDF](https://hpi.de/fileadmin/user_upload/fachgebiete/doellner/publications/2011/LTD2011/clehmann_geoviz2011.pdf)).
For a camera that is either moving or parked, this captures most of MapLibre's benefit in a
handful of lines.

Elsewhere: **deck.gl** samples a **5×5 neighbourhood** (`const int N = 2`) of the collision
map and uses the matched *fraction* as `collision_fade` — soft transitions for free.
**CodeCharta** uses `opacity 0.2s ease-out` plus its stable winner key. **Google** named the
failure mode in [US8237745](https://patents.google.com/patent/US8237745): "crawling" is
labels appearing "to move along a dimension of its associated map feature", fixed by
**deterministic recursive bisection** so anchor position is a function of the feature, never
of the viewport. **Floating Labels** takes the opposite tack: leave the algorithm alone,
spread each change over several frames
([PDF](https://vca.informatik.uni-rostock.de/~schumann/papers/2008+/floating_labels.pdf)).

**The pattern across all of them:** make placement infrequent, make identity stable, animate
the delta, and prefer last frame's answer when it is still valid.

### Q4. Is monotonicity under zoom an explicit guarantee anywhere, or emergent?

**Explicit in exactly one place, and it is a paper, not a product.** Been, Daiches & Yap,
*Dynamic Map Labeling*, InfoVis 2006
([PDF](https://cs.nyu.edu/~visual/home/pub/infovis06.pdf)). Their four consistency
desiderata, verbatim:

- **(D1)** "Except for sliding in or out of the view area, labels should not vanish when
  zooming in or appear when zooming out." This "ensures that labels do not appear, disappear
  and re-appear under monotonic zooming."
- **(D2)** "As long as a label is visible, its position and size should change continuously
  under the pan and zoom operations."
- **(D3)** "Except for sliding in or out of the view area, labels should not vanish or
  appear during panning." Given D2, this follows from making selection a function of scale.
- **(D4)** "The placement and selection of any label is a function of the current map state
  (scale and view area). In particular, it does not depend on the history of how we arrived
  at that state."

Their diagnosis of the naive approach is our situation precisely. Filter to the view, then
run a static labeller, and with priority A > B > C, "C disappears because it conflicts with
B. Then C reappears when B disappears because of its conflict with A." And the sentence that
should govern our design: **"Notice that imposing a global priority order on the labels
doesn't help.** The source of the problem — the fundamental stumbling block for dynamic
labeling — is that from frame to frame the labeling is done on a different set of labels
and/or a different set of label conflicts."

**The construction.** Because D2 forces placement to be continuous in scale, visualise each
label as a shape extruded along a scale axis (a **cone**, for screen-size-invariant labels).
D1 then means each label is selected on exactly one scale interval — its **active range**
`A_L = [s_min, s_max]`, with `s_min = 0` under the strict reading. Restrict the extrusion to
that range and you get a **truncated extrusion**; the overlap condition becomes "no two
truncated extrusions intersect", which guarantees no on-screen overlap at *any* scale. The
only free variable per label is the scalar `s_max`, so selection is **one-dimensional
interval selection**, and the objective reduces to maximising `Σ (s_max − s_min)` —
**active range optimisation (ARO)**. NP-complete in general, but adding priorities makes a
one-pass greedy provably optimal: take labels highest priority first and "make each
truncated extrusion as high as we can, without overlapping any previously determined (and
higher priority) truncated extrusion."

The payoff: **the interaction phase does no collision work at all** — display a label iff
the current scale is in its active range. Also useful from their §5: keep four candidate
placements per label and choose the one that **allows the widest active range**; and to
relax D1, partition scale into LOD buckets (they use h = 8) with a *live range* per label,
so "a label can vanish when zooming in, but only upon reaching the lower end point of its
live range."

**No shipping system guarantees D1, and several break it deliberately.** OSM Carto stops
labelling large administrative areas above a size — `[way_pixels < 360000]`, `[zoom < 14]`,
`[zoom < 15]` caps — because a country label at street zoom is noise, not information.
Tilezen's `min_zoom` is a one-sided floor, not a guarantee. Google's patent treats
non-monotonic motion as a defect to *reduce*. Schwartges surveyed practice and found
commercial navigation systems "not satisfactory… most systems are very conservative: they
block large areas around a labeled point in order to avoid that labels overlap when the user
interacts with the map" ([PDF](https://ceur-ws.org/Vol-1136/paper6.pdf)) — practice buys
consistency by wasting space, not by solving an interval program.

**Where monotonicity is emergent rather than guaranteed:** ECharts' `visibleMin`. Because a
cell's screen area is monotone increasing in zoom, a pure threshold on screen area *is*
automatically a one-sided active range.

**This is the most important structural fact in this report for Atlas.** Our geometry is
static and cell screen size is monotone in zoom, so a size-threshold eligibility rule gives
us D1 **for free** — no interval program, no preprocessing. The only thing that can break it
is *competition* between labels.

**And competition is exactly where we are today.** Both views select labels by sorting on
fade alpha, which is saturated at 1.0 at steady state, so the comparator is a no-op and
slots go out in paint order. In the treemap the first on-screen file sits at rank 382 of 861
qualifying, and 0 of the top 140 are on screen. Paint order has no stable relationship to
the camera, so Atlas does not merely fail to guarantee monotonicity — it cannot approximate
it. That is why the symptom reads as "arbitrary". **Fixing the sort key is a precondition
for monotonicity, not an optimisation of it.**

### Q5. For nested rectangles, how do parent and child labels compete?

**The shipped convention is a reserved header strip, and the reason it works is that parent
and child labels then occupy disjoint geometry and never compete at all.** This is the
answer, and it dissolves the question rather than solving it.

- **Lü & Fogarty** name the design class and state the convention: *"Labeled treemaps
  therefore extend nested treemaps by both placing a border around internal nodes and
  further dedicating space to the consistent placement of labels, **generally at the top of
  each node**."* And: *"**A common label placement is at the top of each internal node**, as
  in Figure 3's illustration of the Java package structure created using the University of
  Maryland reference Treemap implementation"*
  ([PDF](https://homes.cs.washington.edu/~jfogarty/publications/gi2008.pdf)).
- **They also quantify the cost, which we must design around.** §5, Fig. 11: a node worth
  151 units drawn at 286 px beside a node worth 18 units drawn at 210 px, because *"what is
  missing from this process is a consideration of how much of each sub-rectangle will be
  dedicated to labels and borders within the subtree."* **Reserving a strip lies about area,
  and the lie compounds with depth.** CodeCharta's
  `FLOOR_LABEL_MAX_FRACTION_OF_FOLDER = 0.15` is exactly a cap on that distortion, and we
  need one too.
- **ECharts** makes the split a first-class distinction with two separate option objects:
  *"`series-treemap.label` specifies the style when a node is a leaf, while `upperLabel`
  specifies the style when a node has children, **in which case the label is displayed in
  the inner top of the node**"*
  ([treemap.md](https://github.com/apache/echarts-doc/blob/master/en/option/series/treemap.md)).
- **d3-hierarchy** provides no labels whatsoever but provides the mechanism: `paddingTop` is
  *"used to separate the top edge of a node from its children"*
  ([docs](https://d3js.org/d3-hierarchy/treemap)). Reserve the strip in layout, then draw
  into it.
- **CodeCharta** achieves disjointness in a different medium: folder names baked into the
  ground plate as a **decal** (one canvas per tree depth, font clamped by
  `getFloorLabelPadding`), file names as **billboards**. A decal and a billboard cannot
  collide, so the contest never arises.
- **Depth-based LOD is the confirmed convention, not a guess.** Lehmann et al. annotate only
  top-hierarchy nodes; CodeCharta uses `depth < 3`; FoamTree caps labelled depth with
  `maxGroupLabelLevelsDrawn`; Vernier & Nigay shrink borders and labels on descent —
  *"Borders and labels for non-leaf nodes start out large at the root and shrink on
  descending in the tree."*
- **Highcharts** does treat it as a contest, and crudely: `allowOverlap: false` "applies
  collision avoidance logic to hide overlapping labels", with `levels.dataLabels` for
  per-depth styling
  ([allowOverlap](https://api.highcharts.com/highcharts/series.treemap.dataLabels.allowOverlap)).
- **MapLibre's analogue** is collision groups — a predicate on the grid query letting two
  classes coexist without competing.
- **When a parent has no header strip** because it is fully tiled by its children, use
  `polylabel`: parent rectangle as outer ring, children as holes, and it returns the most
  distant interior point. I verified in
  [the source](https://github.com/mapbox/polylabel/blob/master/polylabel.js) that
  `pointToPolygonDist` iterates *all* rings for both ray-cast parity and distance, so holes
  are handled correctly. Priority-queue grid subdivision, globally optimal within a
  precision parameter.
- **The dissenting answer, and it may be right at our density.** Fekete & Plaisant,
  labelling a million-item treemap: *"**Labeling each item cannot be done statically on a
  dense visualization** so we used the Excentric Labeling technique… and extended its design
  for the Treemap"* — labels displayed dynamically *outside* the region, which is greyed out
  ([TR 2002-01](https://www.cs.umd.edu/hcil/trs/2002-01/2002-01.pdf)). At the depths where
  Atlas has thousands of qualifying files, this is the honest design, not a fallback.

**Honest gap:** there is no published algorithm for parent/child label *competition* in
treemaps. Every system above avoids the contest by geometry (strips), by medium (decal vs
billboard), by depth budget, or by moving labels off the map entirely. If we want them to
genuinely compete for one shared budget, we are designing without prior art and the
judgement call is unavoidable. My advice is not to — take the strip.

### Q6. In perspective, label on a face versus a leader line to a floating label?

**The split in practice is by what the label identifies, not by geometry**, and it maps onto
our two entity types exactly: **ground plates get decals, extruded volumes get billboards**
(CodeCharta), with the surface case now backed by a published technique (Lehmann et al.).

Lehmann/Trapp/Döllner name our symptom — *"textual annotations in three-dimensional
environments typically suffer from ambiguousness, illegibility and instability"* — and give
four transferable rules: restrict label positions to **the top face of a node** for full
visibility at low cost; **scale labels non-uniformly to the node's diagonal** so they read as
*area* labels rather than point labels; tilt by camera angle (*"θ = 0° means the camera views
from above. In this case, no further rotation is necessary… In case of 0° < θ < 90°, the
degree of tilt is linearly interpolated"*); and move labels only after the camera stops.

What breaks with each, from CodeCharta's source comments:

- **Decal** — minified at a glancing angle, so it over-blurs; fixes are
  `anisotropy = maxAnisotropy` plus a dark outline, because *"white glyphs on a transparent
  canvas fade to semi-transparent gray once mipmaps average them with their transparent
  neighbors"*. A decal cannot dodge anything, and its size is capped by the plate.
- **Billboard** — always legible, never self-occluded, but has no spatial anchoring, so it
  needs an anchor rule, a collision pass, and usually a leader. deck.gl exposes the whole
  choice as one boolean: `billboard: true` faces the camera, `false` locks text into the
  ground plane.

**Leader lines become state of the art precisely when the label cannot fit inside the
object's projected footprint** — for tall thin boxes at shallow pitch, the normal case.
Bekos et al. classify leaders by segment string over `{s, p, o, d}`, with `opo` dominating
boundary labelling. The implementation to read is CodeCharta's
[connectorDrawing.service.ts](https://github.com/MaibornWolff/codecharta/blob/main/visualization/app/codeCharta/features/labelSettings/services/connectorDrawing.service.ts):
one `LineSegments` with a preallocated `Float32Array` and `setDrawRange`,
`MAX_CONNECTORS = 200`, `BASE_OFFSET_PX = -20`, `MIN_CONNECTOR_DISTANCE = 0.5` (no leader
for a hairline gap), `MAX_DISPLACEMENT_PX = 100` — **past that the label is dropped, not
tethered**, which is the right instinct.

**Occlusion.** Cesium is the reference and heavier than we need: a manual depth test in the
fragment shader against `czm_globeDepthTexture` (*"Extra manual depth testing is done to
allow more control over how a billboard is occluded"*), then a depth rewrite so the hardware
test cannot disagree
([BillboardCollectionFS.glsl](https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Shaders/BillboardCollectionFS.glsl)).
The transferable idea is their key-point variant — sample depth at three corners and reject
only if *all three* fail, so *"if any key point of the label is visible, the whole label will
be visible"* and a partly-occluded label shows whole rather than chopped. Their escape hatch
`disableDepthTestDistance` has a documented cost: it *"pushes the billboards to the near
plane, which messes up the collision detection"* for picking. Hardware occlusion queries
carry a **one-frame readback latency**, making them a poor fit during an orbit.

**GPU tricks are on the table, since we control the renderer.** We already read back an id
buffer for picking, so "is this box visible at all" is a *set-membership query against a
buffer we already have* — cheaper than an occlusion query, with no latency beyond the
readback we already pay. And **deck.gl's GPU collision map is the same buffer used a second
way**: an FBO at `DOWNSCALE = 2`, `rgba8unorm` + `depth16unorm`, drawn as a picking pass so
each fragment's colour *is* the object id, priority baked into clip z so the depth test
resolves the contest; then each instance samples its 5×5 neighbourhood and fades by matched
fraction. Docs: "collisions are computed on the GPU in realtime, allowing the collisions to
be updated smoothly on every frame."

One more perspective detail from MapLibre: `symbol-z-order: viewport-y` iterates
depth-sorted indices **in reverse**, so the front-most symbol is placed *first*. That is the
depth-priority rule for a city — nearest wins the slot.

### Q7. What do these systems do about truncation?

**ArcGIS Maplex has by far the best-documented answer, and it is a ladder tried in order**:
stacking → feature overrun → **font size reduction** (lower limit + step interval) → **font
width compression** (0.1–100% of base width, 0.1–50% step) → **abbreviation dictionary** →
key numbering → **truncation**. The dictionary has three entry types with a clever
conditionality rule: *keyword* (all words but the last) and *ending* (last word only,
Street→St) are "only applied to words when the original string can't be placed", whereas
*translation* entries always apply. Truncation is last and hedged: minimum word length, a
marker character, "characters to remove first" (consonants), characters never to remove, and
"two- or three-letter words with one or more vowels are not truncated"
([docs](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/text/abbreviate-and-truncate-labels.html)).

The rest implement a subset:

- **MapLibre**: wrap (`text-max-width`, default 10 em) and **drop**. That is all — no
  abbreviation, no font reduction, no ellipsis.
- **Mapnik**: `wrap-width`, plus font-size fallback via the `simple` grammar —
  `"N,S,E,W,16,14,12"` generates 12 ordered candidates with **font size as the outer loop
  and direction as the inner**: "First all directions are tried, then font size is reduced
  and all directions are tried again."
  ([simple.cpp](https://github.com/mapnik/mapnik/blob/master/src/text/placements/simple.cpp)).
  Degrade geometry before typography.
- **ECharts**: `overflow: 'truncate' | 'break' | 'breakAll'` (trailing ellipsis / break by
  word / break by character) with explicit `width` and a configurable `ellipsis` string.
- **Tangram**: `text_wrap` (15 chars) and `max_lines`, beyond which labels are "truncated
  with `…`".
- **FoamTree**: shrink-to-fit between `groupLabelMinFontSize` and `groupLabelMaxFontSize`
  with multi-line wrapping, fitted to the **largest inscribed rectangle** of the polygon.
  This is, I believe, the main reason its labelling looks better than everyone else's: it
  solves "what is the biggest axis-aligned box actually available inside this shape" and
  fits type to *that*, rather than centring on a centroid and hoping. Caveat: closed source,
  so docs-level only — see Gaps.
- **CodeCharta decals**: font clamped to plate padding, string fitted to the plate, decided
  once at build time so it never varies with camera.

**This section is urgent rather than cosmetic for us**, because nothing in Atlas calls
`ctx.clip` anywhere — so there is no clipping and no ellipsis at all, in either view. With no
clip and no measurement-driven elision, a label is not merely ugly when it overflows; it is
*lying about its extent*. Every technique in Q1–Q3 depends on the collision box equalling
the painted extent. A collision index built over boxes that don't match what is drawn cannot
prevent overlap, and a size-eligibility predicate cannot gate on "does the name fit" if the
name is never fitted. **Clipping is a precondition for the collision work, not a polish pass
after it.**

Nothing published addresses truncation *in perspective* specifically — a real gap.

---

## 3. Recommendations — implementation order

Nine items, priority order. Each says what it costs and what it buys. Written to be read
standalone.

Two observations from code review set this order, and both moved items to the front:

- Selection sorts on **fade alpha**, which saturates at 1.0 at steady state, so the
  comparator is a no-op and slots go out in **paint order**. "Biggest wins" is not merely
  unimplemented, it is inverted: in the treemap the first on-screen file sits at rank 382 of
  861 qualifying, and 0 of the top 140 are on screen.
- **Nothing calls `ctx.clip` anywhere.** No clipping, no ellipsis, in either view.

Both are preconditions for the rest, not improvements on it.

### 1. Split the three quantities that are currently one, and sort by a real priority

**Cost:** a comparator and a field. Hours, not days.
**Buys:** the stated rule, and the precondition for everything below.

Three distinct things are being carried by one number today. Separate them:

- **eligibility** — a boolean, from projected size (item 3)
- **priority** — an ordering, from `depth` ascending then screen area descending
- **opacity** — animation state, and *never* an input to selection

*Why first:* this is the direct cause of the reported symptom that no reader can state the
rule, and it is small. Every later item assumes a correct ordering exists; built on paint
order they would each amplify the wrong choice. Precedent: MapLibre's `symbol-sort-key`
(lower placed first), CodeCharta's deterministic path tie-break.

### 2. Clip and elide, using measured text

**Cost:** a `ctx.clip` per cell, a `measureText` cache, and a three-rung fitter.
**Buys:** painted extent equals computed extent — without which items 3 and 4 cannot work.

Three rungs, no more: shrink toward a minimum legible size → middle-elide → drop. For
filenames, elide the middle and **preserve the extension** (`AuthenticationSer…Test.swift`),
since the extension is the highest-information suffix in a code map. *Flagging that this
specific choice is my recommendation, not a cited practice.*

*Why second:* labels currently overflow their cells, so any box we reason about is fiction.
Skip abbreviation dictionaries and font-width compression — Maplex needs them to fit
"Northwest Territories" on a printed page; we do not.

### 3. One scale-invariant eligibility predicate per node

**Cost:** one comparison per candidate, reusing item 2's measurement.
**Buys:** a rule a reader can state, plus monotonicity under zoom essentially for free.

A label is eligible iff its cell's projected size clears a threshold derived from the
*measured* text: treemap, `screen_width >= measured_text_width + 2·padding`; city, projected
area of the box's top face. Nothing else.

*Why:* this is ECharts' `visibleMin` (default 10 px²) with the threshold derived from type
rather than a constant. Because cell screen size is monotone in zoom, a size threshold *is* a
one-sided active range — Been/Daiches/Yap's D1 without the interval program. Depends on
item 2.

### 4. A uniform-grid collision index plus greedy placement in priority order

**Cost:** ~200 lines. A flat array of buckets, 25 px cells, viewport + 100 px padding,
`seenUids` dedup, early-exit `hitTest`.
**Buys:** "labels overlap" becomes "labels never overlap", in one pass.

Copy MapLibre's `GridIndex` almost literally. Walk candidates in item 1's priority order;
insert the winner's rect; skip anything that hits. Keep MapLibre's two orthogonal bits —
*does it get blocked* and *does it block* — as separate flags per label class; folder headers
should block file labels but not the reverse.

### 5. Reserved header strips for folders; interiors for files

**Cost:** a `paddingTop` in the layout pass, a fraction cap, and a `polylabel` fallback
(~150 lines).
**Buys:** the parent/child contest disappears, and labels sit on the thing they name.

Give every folder rect a `paddingTop` sized to its header type, as d3 intends and ECharts'
`upperLabel` does, and **cap the strip as a fraction of the node** (CodeCharta uses 0.15).
Lü & Fogarty document both the convention and its cost: reserving space lies about area and
the lie compounds with depth, which is what the cap bounds. For folders with no room for a
strip, fall back to `polylabel` over (parent rect − children rects) — it handles holes. Also
adopt depth-based LOD here: label only the top few levels, as Lehmann et al., CodeCharta and
FoamTree all do.

### 6. Move-only-on-settle

**Cost:** a camera-idle flag and a guard around re-placement. Very small.
**Buys:** most of the stability benefit, for a fraction of item 7's complexity.

Freeze label *positions* while the camera is moving; re-place on settle. This is
Lehmann/Trapp/Döllner's rule, and for a camera that is either moving or parked it captures
most of what MapLibre's throttle-plus-sticky-anchor machinery provides. **Build this before
item 7 and measure — item 7 may prove unnecessary.**

### 7. Opacity state machine keyed on a stable id

**Cost:** a per-node state map, a 300 ms throttle, a fade tick.
**Buys:** every visibility change becomes a fade instead of a pop.

Only if item 6 leaves visible popping. Recompute placement at most every ~250–300 ms, animate
each label's opacity toward its placed/unplaced target over that duration, keep
unplaced-but-still-fading labels alive until opacity reaches zero, and key that state on the
node's **path** — a stable identity we already have, which never needs reconstructing the way
Mapbox's `crossTileID` does. Observe item 1's discipline: opacity is an *output* of placement
and must never feed back into selection.

### 8. City specifics

**Cost:** one canvas per tree depth for decals; a top-face anchor and diagonal scale for
billboards; reuse of the existing id buffer.
**Buys:** legible city labels that read as belonging to their box, with correct occlusion.

- Bake folder names into the plate texture in world space (one canvas per tree depth, one
  draw call, `anisotropy` maxed, dark outline).
- Place file labels on the **top face only**, and **scale text to the node's diagonal** so a
  name reads as an area label belonging to the box rather than a point label floating above
  it. Interpolate tilt linearly with camera pitch (θ=0° top-down, no rotation).
- Place **front-to-back** — MapLibre's `viewport-y` rule.
- Test occlusion by set membership against the id buffer we already read back for picking.
- Add leader lines only where a label cannot sit within the projected footprint, and
  hard-drop past a displacement cap (~100 px) rather than drawing a long tether.

### 9. Precomputed active ranges (ARO) — only if 1–8 leave instability

**Cost:** a preprocessing pass per layout, plus an interval per node. Non-trivial.
**Buys:** a hard monotonicity guarantee and *zero* per-frame placement.

Unusually applicable to us because our geometry is static: run the Been/Daiches/Yap greedy
once per layout, store `[s_min, s_max]` per node, and the runtime becomes an interval test.
Hold it until 1–8 are in and measured, since items 3 and 6 capture most of the benefit far
more cheaply — but if labels are still unstable after those, this is the next move, not more
tuning.

### Deliberately not ported

- **Variable anchors and fallback position chains.** Mapnik's and Maplex's position ladders
  exist because point features have no natural label box. Our cells *are* boxes; one anchor
  per cell is correct, and adding candidates reintroduces the jitter that MapLibre then needs
  a 3-pass sticky-anchor loop to suppress.
- **Simulated annealing / Wagner & Wolff.** The empirical staircase runs random → greedy →
  gradient descent → 2-opt → annealing; greedy was 79 lines of C against annealing's 239;
  "Three Rules Suffice" reaches within 1–2% of annealing at 30–100× the speed. But all of it
  optimises *count of labels placed*, which is not our complaint. Ours is an unstateable rule
  and unstable labels, and greedy with a correct stated priority fixes that.
- **deck.gl-style GPU collision map** — only if the CPU pass shows up in a profile. We are
  well placed for it (we already render an id buffer; priority-as-clip-z is a two-line
  change), so it is a cheap escalation later.
- **Excentric labelling** — deferred as a *feature* decision, not a technical one. When cells
  are smaller than a glyph, labelling the ~20 under the cursor into a gutter fan is the honest
  answer where item 3 legitimately names nothing. Fekete & Plaisant concluded static
  labelling is impossible at million-item density.

### The consolidated stability story

Three sources in this entire survey treat stability as a first-class problem, and they
compose cleanly:

- **Been/Daiches/Yap** — monotonicity under zoom (item 9)
- **Lehmann/Trapp/Döllner** — stability under camera motion (item 6)
- **MapLibre** — stability under recomputation (item 7)

Everything else either ignores the problem or buys consistency by wasting space.

---

## 4. Gaps — where there is no prior art to lean on

These are load-bearing. Each marks a place where an implementer must exercise judgement
rather than copy.

- **No published algorithm for parent/child label competition in treemaps.** Every system
  surveyed avoids the contest by geometry, medium, depth budget, or by moving labels off the
  map. If we want genuine competition for one shared budget, there is no literature behind
  it. (See Q5.)
- **No published treemap label-*placement* algorithm at all.** The convention has a named
  source (Lü & Fogarty) and the earliest instance is Turo & Johnson 1992, but there is no
  algorithm. Squarified Treemaps mentions labels **zero times** — the label argument for
  squarified layouts is retrofitted by later authors, ourselves included.
- **No controlled study on treemap label legibility**, found in one pass. The nearest are
  [Kong, Heer & Agrawala](https://idl.cs.washington.edu/files/2010-Treemaps-InfoVis.pdf)
  (area/aspect perception, not labels) and
  [*Raising the Bars*](https://graphicsinterface.org/wp-content/uploads/gi2017-6.pdf), which
  deliberately tested designs *without* labels. Treat as **not-found, not non-existent**.
- **Whether active ranges (ARO) ship anywhere.** Strongly implied not — Schwartges'
  survey of commercial practice describes conservative space-blocking instead — but I found
  **no source stating it either way**. Item 9 would therefore be us implementing a paper, not
  copying a product.
- **FoamTree's largest-inscribed-rectangle claim is docs-level only.** FoamTree is closed
  source; the claim comes from its
  [API reference](https://get.carrotsearch.com/foamtree/demo/api/index.html), not from code I
  could read. It is the most promising single idea for fitting type into an irregular
  available area, and it is the least verified.
- **Google Maps' live algorithm is closed.** The patents
  ([US8237745](https://patents.google.com/patent/US8237745),
  [US11461945B2](https://patents.google.com/patent/US11461945B2/en)) state intent, not shipped
  behaviour. Treat "crawling" as a well-named problem and recursive bisection as one
  disclosed solution, not as evidence of what Maps does today.
- **No treatment of truncation in perspective** anywhere in the survey.
- **Not examined:** Plotly's treemap labelling — a listed system I did not get to, so its
  approach is unknown rather than judged. Also unexamined: Gource, Software Galaxies, CityVR,
  Evo-Streets; and community d3 label conventions beyond the documented API (Observable
  rate-limited me).
- **Three named leads that went nowhere**, recorded so nobody re-treads them: **"Kirkpatrick
  nested labelling"** — could not find that it exists; **CodeCity** — "label" appears zero
  times in the 133-page thesis; **the disk-usage tools** (WinDirStat, GrandPerspective,
  DaisyDisk) — they essentially do not label cells, using hover readouts and sidebars
  instead.
- **One unchecked lead** for the deeper history of the header-space trade-off: Demian &
  Fruchter 2006, *Information Visualization* 5(1) 28–46, cited by Lü & Fogarty as the prior
  exploration of nested-treemap presentation.
