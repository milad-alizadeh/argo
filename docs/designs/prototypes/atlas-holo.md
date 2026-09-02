# Atlas prototype — what we chose

Throwaway prototype for #650, part of map #643. This records the decisions so the next
session does not re-litigate them. The prototype itself is `atlas-holo.html`.

## The map that ships

`atlas-holo.html`, of four variants built and judged. The other three are kept only as the
evidence behind that choice and should not be developed further.

| File | Direction | Outcome |
|---|---|---|
| `atlas-holo.html` | glass volumes on a lit table | **chosen**, then rebuilt as a lit model |
| `atlas-model.html` | architect's scale model | best legibility, lost on character |
| `atlas-night.html` | emissive night city | best looking, its picture was wrong |
| `atlas-codecharta.html` | the plain original | the control |

The hologram treatment did not survive its own repair. Solid faces, occlusion and a real
light model were needed to make bands readable, and the glass, the inside-out glow and the
boot sweep went with them. What ships is a lit diorama with scanlines. That is a fair trade
and it is written down here because the file name no longer describes the file.

## Two views, one camera

**City** is the 3D view and it is the one that ships. **Treemap** is the same layout seen
straight down, and it is a secondary view, not a replacement.

They are one camera, not two renderers: a single parameter runs 1 to 0, scaling heights,
pushing the eye to infinity, and gating every wall, shadow, sheen, rim and crowding term. At
1 every expression reduces to the original, so adding the treemap could not change the city.

The treemap measures better on everything except the question it cannot answer:

| | City | Treemap |
|---|---|---|
| Picking, 1,483 centres | 0 blind | 1,483 / 1,483 |
| Bands vs the legend swatch | 99.1 / 98.7 / 97.8 % | 100 / 100 / 100 % |
| Static rebuild | 6.6 ms | 1.9 ms |
| Folder names placed | 32 | 50 |

It reads better because nothing is lit: the fill is the band's own swatch. The city keeps its
place because it is the only view that shows the height channel, and because a place is worth
more than a chart when the reader has never seen the repository before.

## The renderer, when this becomes Swift

**Metal, instanced, in an `MTKView` behind `NSViewRepresentable`.** Not three.js in a
`WKWebView`: a second rendering stack, a bridge for every hover, text that fights the app's
scaling, and none of the app's tokens. Not RealityKit, which is an AR scene graph with physics
and PBR that nothing here needs. Not SceneKit, which is in maintenance and whose per-node cost
at 1,500 nodes sends you to instancing anyway.

The map is a fixed orthographic projection of flat-shaded boxes. Every file is one instance:
one draw call, a per-instance transform and band colour, and the lighting the prototype
hand-rolled in 2D becomes a few lines of shader.

**Pick with an ID buffer.** Render instance ids to an offscreen texture and read the pixel
under the cursor. Most of the defects in this prototype were hit-test drift — the pick
resolving against a different camera than the frame was drawn with. An id buffer cannot
disagree with the screen, because it is the screen.

## Rules the prototype proved worth keeping

- **A written layer is optional and separate.** Measurements draw the map; notes live in their
  own file, are fetched optionally, and a repository without them draws the same map.
- **Nothing may be lit at the cost of its band.** Every lighting term is a scalar multiply on
  the band's pigment, never a hue shift and never a wash toward white.
- **Focus never repaints the thing it marks.** Hover is an instant roof outline; a pinned file
  traces its whole volume and holds. Marking a block by recolouring it destroys the fact the
  reader was inspecting.
- **Nothing moves at rest.** Ambient motion makes a map unreadable. The render loop sleeps.
- **Bands answer "which group", never "which is worst".** A ranked list by the current colour
  measure does that, because the top band is flat and a 58 looks like a 20.
- **Claims are measured, not asserted.** Picking counts, pixels changed at rest, and roof
  pixels against the legend swatch. Every regression in this prototype was found that way, and
  the one blind assessment found defects three self-reports had missed.

## Regenerating

`atlas-serve.mjs` serves the page and can rebuild the map from the repository; `atlas-regen.js`
puts the button in the panel. Needs a JDK 11+ and git — `ccsh` arrives through `npx`, so there
is nothing to install. The notes pass spends model calls, so it arms on the first click and
runs on the second, and rewrites only the notes whose subject changed.

On a plain static server the endpoint is absent and the button does not appear, which is the
same contract the notes layer follows.
