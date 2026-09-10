# Where the accent is spent

Ion Blue is brand, selection and focus and nothing else (`rules/swift.md`). Rationing
it is only half the rule: a hue reserved for selection and then spent nowhere the reader meets
selection buys a shell that reads as a stock, greyed-out Mac app. #875 put it back. These are
its placements, and only these.

| Placement | Drawn by | Weight |
|---|---|---|
| A selected row, in every list that has one — the roster, the Work room's view list, and the backlog | `interaction.selectionGround`, as a `listRowBackground`, via `.argoSelectedRowGround(isSelected:)` | `accent` at 0.18 over the rail, **resolved opaque** |
| The rooms picker's selected segment | the `AccentColor` **asset**, which `NSSegmentedControl` fills with | full |
| Focus rings and stock accented controls | the same asset | full |
| The selection indicator on a tab | `interaction.selectionIndicator` | full |
| A link, and the ink an interactive word takes | `interaction.accent` | full |

One hue, two weights: full strength on a CONTROL, a quiet ground under a ROW. The weight is
whatever leaves every voice a row is read in above `TextRoles.contrastFloor`, which
`SelectionGroundTests` asserts absolutely on both of a row's grounds (#922).

## Every selected row takes the same weight

The backlog spent a run on the loud one, on the argument that the room's subject should be
louder than a rail beside it (#1071). What that bought was the loudest band in the window on the
row the reader spends all day in, a row that had to be set in `text.onAccent` because
`text.tertiary` and Ion Blue have the same luminance, and an opaque plate under anything
carrying its own colour. #1165 gave all three of those up: the backlog wears
`interaction.selectionGround` like every other list, its voices are the neutral ramp on both of
its grounds, and a chip or a mark is read where it sits. `BacklogSelectionGroundTests` holds
those readings; the arithmetic that made the loud rung unworkable is kept in D30, because it is
why the quiet one is safe.

## `selectionGround` is opaque by contract (#922)

The platform's own fill was still drawn under it when this was written, so a translucent value
composited onto that fill instead of replacing it, which is how a 0.10 wash shipped as a
near-grey `#484E58` and took `text.tertiary` to 2.49:1. The fill is switched off now (#1137) and
the ground stays opaque anyway: what the contract asserts is what the row draws, whatever the
platform is or is not painting under it. `ContractSpecimen` draws the role by hand beside the
full-strength rung.

## The asset is the only route to the loud half

`AccentColor` reads no palette, so `AccentAssetTests` keeps the shipped file and
`interaction.accent` one value; they had already drifted once. Re-colouring it moves every
stock accented control in the app at the same time, by intent.

## The platform will not colour a list's selection, so it is switched off

On macOS 26 the `.listStyle(.sidebar)` capsule is a fixed neutral: neither `.tint` nor the
asset moves it. Draw the row's ground with `listRowBackground`, opaque, in every list (#906):
a new one asks `.argoSelectedRowGround(isSelected:)` rather than growing a second copy of the
same ternary. That modifier also carries the probe that sets `selectionHighlightStyle = .none`
on the table above it (`ListSelectionFill`, #1137), because covering the platform's fill leaves
it uncovered on the row under a held click — the table moves its selection on mouse-down and the
`List` binding on mouse-up.

## Judge selection off a render, never off a preview

A preview of an `ArgoUI` view builds the package alone and cannot see the asset, and an
inactive window draws the platform's own selection in an unemphasized grey. The `selectedRow`
specimen renders both weights in one frame, in the app target.
