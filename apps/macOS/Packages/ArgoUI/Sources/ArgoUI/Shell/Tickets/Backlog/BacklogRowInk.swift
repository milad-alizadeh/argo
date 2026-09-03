import ArgoDesign

/// What one backlog row is drawn in, and the ground it is read on — the room's one selection, on
/// the SAME quiet ground every other selected row in the app wears (#1165, reversing #1071's
/// placement; D30).
///
/// A value rather than three call-site conditionals, because the contract asserts these readings
/// absolutely — `BacklogSelectionGroundTests`.
package struct BacklogRowInk: Equatable {
    /// The opaque surface this row is READ on, and the one thing selection changes: the deck under
    /// an unselected row, the selection ground under the selected one. It is not laid from here —
    /// `argoSelectedRowGround` lays it, as it does in both rails — so this is the ground's reading
    /// half alone, handed to whatever on the row carries a colour of its own.
    package let readOn: ArgoColor
    let title: ArgoColor
    /// The `#id`.
    let machine: ArgoColor
    let caption: ArgoColor

    package init(isSelected: Bool, isRail: Bool, palette: ArgoPalette) {
        self.readOn = isSelected ? palette.interaction.selectionGround : palette.surface.base
        // The neutral ramp on BOTH grounds, unchanged by selection: `secondary` reads 5.91:1 on
        // the selection ground and `tertiary` 4.63:1, so the ground alone says which row is
        // selected (#1165).
        //
        // A rail is on screen for a descendant's sake rather than for its own match, so its title
        // takes the demotion the `#id` beside it already carries (#873).
        self.title = isRail ? palette.text.tertiary : palette.text.secondary
        self.machine = palette.text.tertiary
        self.caption = palette.text.disabled
    }
}
