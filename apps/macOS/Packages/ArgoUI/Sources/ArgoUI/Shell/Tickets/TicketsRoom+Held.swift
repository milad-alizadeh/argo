import SwiftUI

/// What the Tickets room HOLDS rather than reads - the values that outlive the panes, and so are
/// owned above them.
///
/// Its own file rather than more of `TicketsRoom`, which is at `type_body_length`: the room's job
/// is the two panes, and this is the list of things the panes are rebuilt around rather than part
/// of building them.
package extension TicketsRoom {
    struct Held {
        /// What the backlog's FIELD holds — the query, the question it can raise, and the listing
        /// that question would be answered over (#1317). One value because it is one control's
        /// worth of state, and because `Held`'s own slot list is at the 4-parameter cap.
        var field: Field
        /// The backlog's selection (#1247). Beside the query and above the room, for the query's
        /// own reason: the panes are rebuilt on every ticket, and a range owned any lower would
        /// be lost by the first click that changed anything.
        var selection: Binding<RowSelection<Int>> = .constant(RowSelection())
        /// Open the ticket pane on a row the backlog has already settled the selection for.
        var opened: @MainActor (Int?) -> Void = { _ in }
        /// What a backlog row's right-click menu offers, and what pressing an item does (#1247).
        /// Inert by default: a preview draws the menu without a provider behind it.
        var acts = BacklogSelectionActs()

        /// The field's own three, held above the room for the query's reason: the panes are
        /// rebuilt on every ticket, and an answer owned any lower would be lost by the first
        /// click that changed anything.
        package struct Field {
            var query: Binding<String>
            /// The question the field can raise, and where the one in flight has got to.
            var asking = BacklogAsk()
            /// Every ticket the open view holds, by number, before the query narrowed anything —
            /// `TicketsRoomProjection.listing(of:in:)`. What an ask is answered over, and what
            /// the sheet's read line counts.
            var listing: [Int] = []

            /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
            package init(
                query: Binding<String>,
                asking: BacklogAsk = BacklogAsk(),
                listing: [Int] = [],
            ) {
                self.query = query
                self.asking = asking
                self.listing = listing
            }
        }

        /// Nothing remembers it, for a `#Preview` and a specimen with no window above them.
        package static let unheld = Held(field: Field(query: .constant("")))

        /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
        package init(
            field: Field,
            selection: Binding<RowSelection<Int>> = .constant(RowSelection()),
            opened: @escaping @MainActor (Int?) -> Void = { _ in },
            acts: BacklogSelectionActs = BacklogSelectionActs(),
        ) {
            self.field = field
            self.selection = selection
            self.opened = opened
            self.acts = acts
        }
    }
}
