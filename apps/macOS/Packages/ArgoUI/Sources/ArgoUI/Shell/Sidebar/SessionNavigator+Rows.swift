import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One roster row as the list draws it, and what a click on it does — split off
/// `SessionNavigator.swift` so that file's one subject stays the list itself.
///
/// Every member here is internal rather than private for that split alone: an extension in
/// another file cannot see the view's private members, and nothing outside this pair of files
/// names any of them.
extension SessionNavigator {
    /// `.swipeActions` gives the system's reveal, spring back, close-when-another-opens and
    /// full-swipe commit. `allowsFullSwipe` is what keeps story 12 — a hard pull still archives
    /// outright, without a second click.
    @ViewBuilder func swipeable(_ row: SessionRosterProjection.Row) -> some View {
        let drawn = SessionRow(
            row: row,
            renaming: SessionRowRenaming(
                rename: { rename(row.id, $0) },
                isOpen: Binding(
                    get: { renamingRowID.wrappedValue == row.id },
                    set: { renamingRowID.wrappedValue = $0 ? row.id : nil },
                ),
            ),
            archiving: SessionRowArchiving(
                // The whole selection when the row is in it, that row alone when it is not, and
                // only the rows on the SAME side of the foot — so the count in the menu is the
                // number of Sessions the press actually archives.
                targets: SessionRosterProjection.archiveTargets(
                    under: row, aimed: held.selection.aim(at: row.id), in: drawnRows,
                ),
                act: archive,
            ),
            // The selection the `List`'s own click would have made, made by the row instead — the
            // row carries a double-click, and the two cannot share one click. Written through the
            // same binding, so the highlight, the keyboard and the deck all still read one fact.
            select: { chose(row) },
        )
        .previewSafeListRow()

        // A fold takes neither tag nor selection, deliberately: `ForEach` tags a row with its
        // `Identifiable` id whether or not `.tag` is written, so leaving `.tag` off never kept the
        // platform off a fold — and a fold is the one row that carries no ground, and so no probe.
        // `selectionDisabled` is how the app refuses selection there, as `BacklogList` does. It
        // is archived and renamed through the runs under it, so it carries neither gesture either.
        if row.takesSelection {
            drawn
                // Holds its colour while the list is not first responder, where the platform would
                // grey its own selection out: this is the one piece of state a reader tracks all
                // day. The platform's own fill is switched off under it (`ListSelectionFill`),
                // so a row this misses draws no selection at all rather than the wrong one
                // (D30, 2026-08-31; #1137).
                .argoSelectedRowGround(isSelected: reading.isSelected(row))
                .tag(row.id)
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    // A swipe action is re-drawn by the platform from its title and image alone,
                    // so `ArgoRadius.control` cannot reach this button's corner and the capsule
                    // here is not drift (#1257).
                    Button(
                        SessionArchiveProjection.rowTitle(isArchived: row.isArchived),
                        systemImage: SessionArchiveProjection.symbol(isArchived: row.isArchived),
                    ) {
                        archive([row.id], !row.isArchived)
                    }
                    .tint(argo.color.interaction.destructive)
                }
        } else {
            // Refused outright rather than covered: there is no ground to cover it with.
            drawn.selectionDisabled()
        }
    }

    /// The one reading of "which row is selected", which the ground is drawn from.
    var reading: SessionRosterProjection.Selection {
        SessionRosterProjection.Selection(rows: held.selection.rows)
    }

    /// What a click on a row does. A fold is not a Session, so it cannot be selected: it OPENS,
    /// and the runs under it are then ordinary rows the reader can select one by one (#1073).
    ///
    /// Which of the three clicks it is comes off the modifiers held now (#1247) — the title's own
    /// layer answers the click the `List` would otherwise have selected with, so it has to answer
    /// all three of them.
    func chose(_ row: SessionRosterProjection.Row) {
        guard row.takesSelection else { return openFold(row.id) }
        // The deck follows the last click through `onChange` above. The one move that does not
        // reach it that way is a plain click on the row it is already drawing (#10).
        guard held.selection.retriesDrawnRow(.current, on: row.id, over: selectableRows)
        else { return }
        held.pick(row.id)
    }

    var emptyState: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text("No Sessions yet")
                .argoText(ArgoTypography.rowTitle)
            Text("Observed Sessions appear here.")
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
        }
        .padding(.vertical, ArgoSpacing.tight)
        .listRowSeparator(.hidden)
    }
}
