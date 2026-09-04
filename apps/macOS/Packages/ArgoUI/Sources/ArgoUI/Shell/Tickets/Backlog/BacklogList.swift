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
        @Binding var selection: Int?
        @Binding var shut: Set<Int>

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(selection: Binding<Int?>, shut: Binding<Set<Int>>) {
            _selection = selection
            _shut = shut
        }
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
        List(selection: held.$selection) {
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
    }

    /// The list `Closed` draws: one run of rows in the order the projection put them, and no
    /// priority headers over it (#1075). Banding by priority here would scatter last week's
    /// finished work across three headers and fight the recency order the view is defined by.
    private var flat: some View {
        BacklogOutline(
            drawn: TicketsRoomProjection.drawn(rows, shut: shut),
            shut: held.$shut,
            selection: held.selection,
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
            BacklogOutline(
                drawn: drawn,
                shut: held.$shut,
                selection: held.selection,
                folds: header.structure.folds,
            )
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
    BacklogList(rows: [], held: .init(selection: .constant(nil), shut: .constant([])))
        .frame(width: ArgoBacklogList.width, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
