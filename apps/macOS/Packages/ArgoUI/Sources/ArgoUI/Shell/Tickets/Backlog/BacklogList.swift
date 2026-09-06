import ArgoDesign
import SwiftUI

/// The deck's leading pane — the backlog, banded by priority over its roots (#819). Its width is
/// the CALLER's: the pane rests at `ArgoBacklogList.width`, which is the measure the titles were
/// chosen against, and the reader drags it from there (`TicketsRoom.deck`). It carries no frame of
/// its own — #836's `minWidth/idealWidth/maxWidth` let the `HStack` distribute the deck between
/// the two panes, and the seam settles that now. The floor those named survives as the seam's
/// (`ArgoLayout.backlogWidths`).
package struct BacklogList: View {
    /// The tree's roots, banded here: which rows a band draws depends on the fold, which is the
    /// pane's state rather than the room's.
    let rows: [TicketsRoomProjection.Row]
    /// What the reader has done to this pane and nothing else — which row is selected, and which
    /// parents are folded. Both outlive the pane, so both are held above it, and they travel as
    /// one value because every row in the list is drawn from the pair (#1071, #814).
    var held: Held
    /// What the heading over the list says. Words only — the field that narrows the list is on this
    /// pane's own header band, see `TicketsPaneHeader`.
    var header: TicketsChromeProjection.Reading = .none
    /// What reads the next page of closed tickets, and `nil` wherever there is no next page to read
    /// — every open view, and the closed one once the provider has served its last (#1075).
    var more: (@MainActor () -> Void)?

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        rows: [TicketsRoomProjection.Row],
        held: Held,
        header: TicketsChromeProjection.Reading = .none,
        more: (@MainActor () -> Void)? = nil,
    ) {
        self.rows = rows
        self.held = held
        self.header = header
        self.more = more
    }

    package struct Held {
        /// Every selected row, the ticket the pane is open on, and the way to open another
        /// (#1247). One value, because the `List`'s own binding and the row's ground are both
        /// read off the selection in here.
        var picking: RowSelectionHold<Int>
        @Binding var shut: Set<Int>
        /// What the row's right-click menu offers, and what pressing an item does (#1247). Here
        /// because it is the SELECTION's verbs: what the menu covers is what `picking` holds.
        var acts = BacklogSelectionActs()

        /// Whether Argo grounds this row — the `List`'s own answer, so the two cannot disagree.
        func isSelected(_ row: Int) -> Bool {
            picking.selection.contains(row)
        }

        /// Whether this parent is drawn open.
        func isOpen(_ row: Int) -> Bool {
            !shut.contains(row)
        }

        /// What a menu opened on this row acts on: the whole selection when the row is in it, and
        /// that row alone when it is not (`RowSelection.aim`). Sorted, because a set has no order
        /// and a batch reported back has to name its Tickets in one.
        func targets(of row: Int) -> [Int] {
            picking.selection.aim(at: row).sorted()
        }

        /// Fold this parent, or open it.
        func toggle(_ row: Int) {
            if shut.contains(row) {
                shut.remove(row)
            } else {
                shut.insert(row)
            }
        }

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(
            picking: RowSelectionHold<Int>,
            shut: Binding<Set<Int>>,
            acts: BacklogSelectionActs = BacklogSelectionActs(),
        ) {
            self.picking = picking
            _shut = shut
            self.acts = acts
        }
    }

    /// Every row this list HAS, whatever is shut — what `RowSelectionReactions` cuts the selection
    /// by, beside the drawn rows.
    private var heldRows: [Int] {
        TicketsRoomProjection.drawn(rows, shut: []).map(\.id)
    }

    /// Every row a range may reach: what the list is drawing now, folds resolved. A row behind a
    /// shut parent is not in here, which is what keeps a range off rows nobody can see (#1247).
    private var drawnRows: [Int] {
        TicketsRoomProjection.drawn(rows, shut: shut).map(\.id)
    }

    package var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            BacklogHeader(reading: header)
            if let stated = header.empty {
                BacklogNoMatch(stated: stated)
            } else {
                list
            }
        }
    }

    private var list: some View {
        List(selection: held.picking.listSelection(over: drawnRows)) {
            if header.structure.groups {
                banded
            } else {
                flat
            }
            if let more {
                BacklogMore(read: more)
                    .previewSafeListRow()
                    .listRowSeparator(.hidden)
                    .selectionDisabled()
            }
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
        .accessibilityLabel("Backlog")
        .modifier(RowSelectionReactions(held: held.picking, drawn: drawnRows, membership: heldRows))
    }

    /// The list `Closed` draws: one run of rows in the order the projection put them, and no
    /// priority headers over it (#1075). Banding by priority here would scatter last week's
    /// finished work across three headers and fight the recency order the view is defined by.
    private var flat: some View {
        BacklogOutline(
            drawn: TicketsRoomProjection.drawn(rows, shut: shut),
            held: held,
            folds: header.structure.folds,
        )
    }

    private var banded: some View {
        ForEach(TicketsRoomProjection.bands(of: rows)) { band in
            // Flattened ONCE and handed to both, so the header counts the rows the outline
            // draws rather than a second answer to the same question.
            // A search draws the tree open whatever the reader folded — a parent that hid the
            // one match would leave the heading claiming a result nobody can see (#873).
            let drawn = TicketsRoomProjection.drawn(band, shut: shut)
            // `.inset` spends about 52 between one section and the next section's word where
            // the design draws 12, and `listSectionSpacing` is unavailable on macOS — so this
            // is a row rather than the `Section` header the frozen name stands in for, and
            // `selectionDisabled` returns the selection behaviour that cost. What it does not
            // return is pinning: `cockpit-work-room.inventory.md`.
            PriorityHeader(band: band, count: drawn.count)
                .previewSafeListRow()
                .listRowSeparator(.hidden)
                .selectionDisabled()
            BacklogOutline(drawn: drawn, held: held, folds: header.structure.folds)
        }
    }

    /// What the list actually folds by: the reader's own set, and nothing at all under a search,
    /// which draws the tree open whatever they folded (#873).
    private var shut: Set<Int> {
        header.structure.folds ? held.shut : []
    }
}

// The state that SHIPS: no port reads a priority yet (#388), so every root bands under the one
// header that says nothing was read rather than being dropped by three that cannot hold it.

// The `Closed` view's own shape (#1075): flat, no priority headers, every row stating its own
// closure, and the foot that reads the page behind this one.

// …and the last page, where the foot is not drawn at all.

#Preview("Backlog list — the provider answered with nothing") {
    BacklogList(rows: [], held: .init(
        picking: .init(selection: .constant(RowSelection())), shut: .constant([]),
    ))
    .frame(width: ArgoBacklogList.width, height: 320)
    .argoDeckSurface()
    .argoAppearance()
}
