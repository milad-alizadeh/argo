# 0038 · The desktop cockpit is opaque

Status: accepted (#1819) · 2026-09-09 · supersedes D2, D3, D14 and D21 of
[the cockpit visual identity decisions](../designs/cockpit-visual-identity-decisions.md) **for
`apps/desktop`**

Binding on `apps/desktop`: this is the contract every UI slice is built to. Depth comes from an ordered ramp of surface colours and hairline borders, and
a shadow is drawn only where the layout anchors nothing. Four design decisions say the opposite,
and this file **supersedes them scoped to `apps/desktop`**, leaving them binding for `apps/macOS`
— the
scoped-supersession shape [ADR-0033](./0033-dom-geometry-is-settled-before-it-is-shown.md) used on
[ADR-0030](./0030-geometry-is-settled-before-it-is-shown.md). Only the shape is borrowed: 0033
stamped 0030 with a matching Status line, and this file leaves the four D-entries unmarked, for the
reason in Consequences.

Nothing here is a new decision. The surface model, the refusal and the frame were settled in
[Decide what draws the cockpit chrome in place of Liquid Glass](https://github.com/milad-alizadeh/argo/issues/1819),
and the token vocabulary the rules name was settled in
[Map ArgoDesign role names onto shadcn's CSS variables](https://github.com/milad-alizadeh/argo/issues/1820).
This file is where the repo keeps both.

## Context

The Swift cockpit's depth is Liquid Glass: translucent, blurred, layered. A pixel-for-pixel
reproduction is out of scope on #1730's map, and the shadcn decision
([#1731](https://github.com/milad-alizadeh/argo/issues/1731)) starts from the default theme with a
custom one deferred. So the repo's only written chrome contract described a material the new app
cannot draw, and no slice could pick a background.

Three facts from the inventory decide the answer rather than taste.

**The opaque model already exists in the Swift app, fully specified.** `ArgoDesign` carries a
four-rung graphite ramp — `sunken #191A1D`, `base #1E2024`, `raised #252729`, `overlay #2E3136` —
four translucent-white edge tokens from `hairline` at 0.08 to `glassRim` at 0.30, and an
elevation scale where three of its six rungs are literally zero: `flat`, `deck` and `vessel` paint
no shadow at all. Only `popover` (18 blur, 8 y, 0.34) and the unwired `dragged` cast one, and
`bloom` is a glow rather than a shadow. `ArgoFloatingGlass`'s flat branch — taken under Reduce
Transparency, Increased Contrast or the forced flag — is already "overlay fill, one stroked edge,
popover shadow", the shape this ADR makes universal. Its edge is `edge.subtle` at
`ArgoStroke.border` rather than the `hairline` token, so the shape carries over and the two token
choices do not. This decision promotes that fallback path to the only path, so it is a promotion
rather than new design work.

**There is no `NSVisualEffectView` in shipping Swift code.** The glass is SwiftUI `glassEffect` in
three places: two surfaces, `ArgoChromeBar` (`.clear` under an 88% `base` wash) and
`ArgoFloatingGlass`, plus one control ground, `ArgoIconButton`'s `.glass` case. Everything else that
reads as translucent is a `.regularMaterial` popover or the system's own sidebar list. A fourth call
sits in `ArgoSpecimens`, which ships nothing. The surface that has to be replaced is smaller than
the design prose suggests. #1819's resolution says two places; it missed the icon button.

**`apps/desktop` had nothing to undo.** When #1819 decided this, the app carried no `globals.css`,
no `components.json` and no Tailwind configuration, and `createWindow` in `apps/desktop/src/main.ts`
passed `width`, `height`, `show` and `webPreferences` and nothing else: no `vibrancy`, no
`titleBarStyle`, no `backgroundColor`, no `trafficLightPosition`. This ADR is the first statement of
what surfaces exist there, and #1828 is the slice that installs the theme and the frame it names.

## Decision

`apps/desktop` draws its depth with colour and edges rather than with material, because the only
material Electron can honestly offer is one the frame budget and the other two platforms rule out.
The rules below are that one commitment spent across the window.

## Rules

**1. Every surface is opaque, on every platform.** Electron's only honest material on macOS is the
`vibrancy` `BrowserWindow` option, a real `NSVisualEffectView`. It is refused for three reasons that
do not expire.

- It is whole-window, not per-region, so it cannot give the sidebar one material and the feed an
  opaque ground. The thing it would be wanted for is the thing it cannot do. `setVibrancy` changes
  it at runtime, so the scope is the reason and creation-time is not.
- It is macOS only. Windows would need `backgroundMaterial` and Linux gets nothing, so one look
  becomes three.
- It is a live backdrop blur composited every frame, paid against
  [#1736](https://github.com/milad-alizadeh/argo/issues/1736)'s absolute frame budget on a machine
  meant to idle with eight Sessions open.

A CSS imitation is not the alternative: [#373](https://github.com/milad-alizadeh/argo/issues/373)
ruled a renderer-drawn imitation out at the design level, and
[ADR-0022](./0022-swift-native-macos-runtime.md) restated it as "never a renderer-drawn imitation".
That clause is the part of 0022 that outlives it: its runtime choice — a pure Swift app, with
`apps/desktop` deleted — is the one #1730 reversed, and no ADR supersedes it, so 0022's Status still
reads accepted.

This is permanent. A later theme that wants translucency argues against those three reasons in a
new ADR; it inherits no licence because a theme arrived.

**2. Depth is a colour ramp plus hairline borders.** The ramp is shadcn's default tokens, unchanged,
and it is drawn in both the light and the dark appearance. The appearance setting offers System,
Light and Dark with System the default, and System follows the operating system (#1820). The ramp is
an ordering of roles rather than a set of values, so it holds in either appearance without a second
table.

**3. A shadow is drawn only on a surface the layout does not anchor**: popovers, menus, dialogs and
dropdowns, and nothing else. "Floating controls" in the table below are anchored — the composer and
the plan pill sit at a fixed place in the deck and are present whether or not the reader is doing
anything — so they take a `card` ground and a hairline, and no shadow. What earns the shadow is
having no place in the layout at all, not being called floating.

**4. One hairline per seam.** Where two bordered regions meet, one of them gives up its border.

## The surface table

| surface | ground | edge | shadow |
| --- | --- | --- | --- |
| window background | `background` | none | none |
| chrome bar (full-width top band, traffic lights inset into it) | `background` | one hairline at its foot, and only there | none |
| sidebar / roster | `card` | hairline on the trailing edge | none |
| deck / feed plane | `background` | none | none |
| rows, rails, minimap, dock | `muted` when raised, else the plane | hairline where a seam is structural | none |
| composer, plan pill, floating controls | `card` | hairline | none |
| popovers, menus, dialogs, dropdowns | `popover` | hairline | yes, the only shadow in the app |

Rules 2 through 4 govern the table, one rule to a column: rule 2 the ground, rule 4 the edge, rule 3
the shadow. The table adds no surface class of its own, so a new surface is placed by asking which
row it already belongs to.

The chrome bar's single hairline at its foot is D10's 2026-08-12 amendment
([#671](https://github.com/milad-alizadeh/argo/issues/671)), which says there is exactly one
hairline, at the foot. It survives the material change intact, because it was never a fact about
glass.

## The window frame

macOS takes `titleBarStyle: 'hiddenInset'` with an explicit `trafficLightPosition` and a drag region
the app owns. It keeps the native window controls.

#1819 wrote two shapes for what sits beside those controls. Its surface table gives the chrome bar
a full width top band with the traffic lights inset into it, and one line of its prose lets the
sidebar run to the top edge instead. The table is the normative artifact, so the band wins: the
chrome bar spans the window, the traffic lights are inset into its leading edge, and the sidebar
starts under it. `trafficLightPosition` therefore places the controls inside the band rather than
over the sidebar.

Windows and Linux take `titleBarStyle: 'hidden'` with `titleBarOverlay`. That is **the direction and
not a verified decision**: no runner has ever executed a package on either platform, so no one has
seen it. A slice that needs it settles it there.

The surface model in rules 1 through 4 is portable and binds all three platforms. The frame is the
one part of this ADR that does not.

## The role mapping is a shape, not values to port

`sunken`→`background`, `base`→`card`, `raised`→`muted`, `overlay`→`popover`. That is the shape
a future theme fills, and it is the whole of what crosses over. The graphite values themselves
are not ported: they are tuned to sit under Liquid Glass — `base` was chosen as the plane a
translucent bar washes over — and `glassTint` has no meaning once nothing is translucent.
Re-tuning them for an opaque cockpit is theme work, held out of scope by #1730's map.

The mapping carries role names and nothing else, so it is not a per-surface migration path. Each
desktop surface takes the rung the table gives it, not the one its Swift predecessor had: the chrome
bar was `base` under a wash and is `background` here.

Per #1820, `apps/desktop` uses shadcn's own names for the roles shadcn already has, adds no
`ArgoDesign` alias for one of them, and ports no Swift measurement scale. Argo colours cross over
only for roles the default theme does not cover, such as PR states and Atlas map colours, kept as
named application colours beside the theme. `ArgoDesign` itself stays with the deprecated Swift app.

## What this does not settle

- **Enforcement.** #1820 leaves the desktop token rule to delivery: `rules/swift.md` matches only
  `apps/macOS/**/*.swift`, and `rules/house.md`'s "tokens by name" has to be reconciled with a
  desktop rule that states this. No automated token gate is added for it; review carries it, over
  both appearances and the extra application colours alike.
- **Windows and Linux chrome**, in *The window frame* above.
- **A custom theme's values.** The default shadcn tokens are what rule 2 commits to, so a slice
  reading this file knows what `card` is today. What is open is a later Argo theme: its colours are
  not fixed here, and the ramp's roles are what it fills.

## Consequences

Every UI slice can now pick a background: it reads the table and takes the row. A slice that finds
no row for its surface has found a decision this file owes it, and asks here rather than inventing a
fifth ground.

This was an ADR and not a design because nothing rendered `apps/desktop` for visual review
([#1758](https://github.com/milad-alizadeh/argo/issues/1758)) and a design drawn then could be
checked against nothing. #1828 opened that route: `apps/desktop/scripts/render-design-page.mjs`
draws a design page and `apps/desktop/scripts/capture-cockpit.mjs` captures the packaged app.
This table is what both are checked against.

The four superseded design decisions are not amended in place, which is where this file departs from
ADR-0033's precedent and does so deliberately (#1819). `apps/macOS` is deprecated and verified by
nothing, so an amendment there is read by nobody, and this file is where a desktop engineer looks.
The cost is real: a reader who arrives at D2, D3, D14 or D21 first gets no pointer here. The
sharpest of the four is D3, whose "a single flat graphite plane behind the roster is a **defect**"
the desktop reverses outright: on `apps/desktop` a flat plane behind the roster is the contract.

D4 is not among them, and its dark-first posture stands. It scopes a *study* rather than an app, so
`apps/desktop` shipping two appearances leaves its decision alone. One clause of it the desktop does
step around: D4 requires a future light interpretation to be "a deliberate translation of the
settled system", and shadcn's default light tokens are not a translation of graphite — they are
the other half of a theme #1820 adopted whole. #1820 is what authorises the light cockpit, and
nothing here reinterprets D4 to reach it.
