# Where the accent is spent

Ion Blue is brand, selection and focus and nothing else (`rules/swift.md`). Rationing
it is only half the rule: a hue reserved for selection and then spent nowhere the reader meets
selection buys a shell that reads as a stock, greyed-out Mac app. #875 put it back. These are
its placements, and only these.

| Placement | Drawn by | Weight |
|---|---|---|
| A selected sidebar row (the roster's, and the Work room's view list) | `interaction.selectionGround`, as a `listRowBackground`, via `.argoSelectedRowGround(isSelected:)` | `accent` at 0.18 over the rail, **resolved opaque** |
| A selected BACKLOG row (the Tickets room's list) | `interaction.accent`, as a `listRowBackground`, from `BacklogRowInk` | full |
| The rooms picker's selected segment | the `AccentColor` **asset**, which `NSSegmentedControl` fills with | full |
| Focus rings and stock accented controls | the same asset | full |
| The selection indicator on a tab | `interaction.selectionIndicator` | full |
| A link, and the ink an interactive word takes | `interaction.accent` | full |

One hue, two weights: full strength where a control is the loud rung or a row is the room's
subject, a quiet ground where a row is a rail beside one. The weight is whatever leaves every
voice a row is read in above `TextRoles.contrastFloor`, which `SelectionGroundTests` asserts
absolutely on both of a row's grounds (#922).

## Which weight a row takes is the row's own decision

The backlog is the room's subject rather than a rail beside it, so its selected row takes the
loud weight (#1071), and no voice off the neutral ramp can be set on it: `text.tertiary` and
Ion Blue have the same luminance. All three of that row's voices take `text.onAccent`, and
anything carrying its own ground (a label chip, the blockage mark) is laid on an opaque
`surface.base`. `LoudSelectionGroundTests` holds every one of those readings.

## `selectionGround` is opaque by contract (#922)

The sidebar capsule is still drawn under it, so a translucent value composites onto the
capsule instead of replacing it, which is how a 0.10 wash shipped as a near-grey `#484E58` and
took `text.tertiary` to 2.49:1. An opaque ground covers it, so what the contract asserts is
what the row draws. `ContractSpecimen` draws the role by hand beside the full-strength rung.

## The asset is the only route to the loud half

`AccentColor` reads no palette, so `AccentAssetTests` keeps the shipped file and
`interaction.accent` one value; they had already drifted once. Re-colouring it moves every
stock accented control in the app at the same time, by intent.

## The platform will not colour a sidebar's selection, and will not stop drawing it

On macOS 26 the `.listStyle(.sidebar)` capsule is a fixed neutral: neither `.tint` nor the
asset moves it. Draw the row's ground with `listRowBackground`, opaque, in every sidebar
(#906): a new rail asks `.argoSelectedRowGround(isSelected:)` rather than growing a second
copy of the same ternary.

## Judge selection off a render, never off a preview

A preview of an `ArgoUI` view builds the package alone and cannot see the asset, and an
inactive window draws the platform's own selection in an unemphasized grey. The `selectedRow`
specimen renders both weights in one frame, in the app target.
