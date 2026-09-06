import SwiftUI

/// A list's selection as the view drawing it takes it (#1247): the reader's own set, the one row
/// the surface beside the list is open on, and the way to move that.
///
/// One value because no list may be handed two of the three — a set without the drawn row cannot
/// tell a range from a click, and a drawn row without the way to move it is a fact the list can
/// read and never act on. `BacklogList.Held` is the same trade for the fold.
package struct RowSelectionHold<Row: Hashable & Sendable> {
    @Binding var selection: RowSelection<Row>
    /// The row the deck — or the ticket pane — is open on. It moves on a CLICK and never on a
    /// range, which is what keeps a four-row selection one thing on screen.
    var pointed: Row?
    /// Point it somewhere else. Inert by default, so a preview draws every gesture without a
    /// window under it.
    var pick: @MainActor (Row?) -> Void
    /// A row this list is about to be given and is not drawing yet — a Session Argo has just
    /// started, whose provisional row has not been published
    /// (`CockpitNavigationModel.awaitedSession`,
    /// #1493). It is exempt from the confining below: a list that drops it takes the deck off the
    /// Session the reader just started, a beat before its row arrives. `nil` for a list with
    /// nothing on the way, which is every list most of the time and the backlog always.
    var awaited: Row?

    /// Where the surface beside the list goes when the row the selection DRAWS moves.
    ///
    /// A `nil` there names no row, so it is never the reader pointing at one: it is the list's own
    /// arithmetic — a fold shutting, a `confine` over rows its order has not caught up with, a row
    /// re-keyed under the selection (#361). `CockpitNavigationModel.reconcile` is what clears a
    /// selection for real, and moving on a `nil` here left it a `nil` to repoint from rather than
    /// an id it could have followed (#1493).
    @MainActor
    package func follow(drawnRow row: Row?) {
        guard let row, row != pointed else { return }
        pick(row)
    }

    /// The selection cut back to the rows this list is DRAWING, which is what stops a menu
    /// offering to act on what a shut fold is over (#1247).
    ///
    /// `membership` is every row this list HAS, drawn or withheld. The difference is what decides
    /// the second exemption: a row the list is withholding — behind a shut fold, behind the
    /// archive foot — is one the reader put away, and the cut is the whole point of it. A row the
    /// list has no entry for at all is a row its order has not admitted yet, which is what a
    /// Session re-keyed the moment its transcript appears looks like from here (#361), and cutting
    /// the drawn row there leaves the roster grounding nothing (#1493). The awaited row is exempt
    /// for the same reason and ends the same way: the list gains an entry for it.
    package func confineToDrawn(_ visible: [Row], of membership: [Row]) {
        let lagging = pointed.flatMap { membership.contains($0) ? nil : $0 }
        selection.confine(to: visible + [awaited, lagging].compactMap(\.self))
    }

    /// The `List`'s own selection: the held set, and the one route the platform's answer comes
    /// back by. Every list bound to a hold takes it from here, so the rule below is not a thing a
    /// call site can be written without.
    ///
    /// A `List` can only name rows it is DRAWING, so while a row is awaited an empty write-back
    /// is the platform reconciling to a row it has not been given — indistinguishable from the
    /// reader clearing the selection by hand, and refused as the commoner of the two (#1493).
    package func listSelection(over visible: [Row]) -> Binding<Set<Row>> {
        Binding(
            get: { selection.rows },
            set: { selected in
                guard !(selected.isEmpty && awaited != nil) else { return }
                selection.absorb(selected, over: visible)
            },
        )
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        selection: Binding<RowSelection<Row>>,
        pointed: Row? = nil,
        pick: @escaping @MainActor (Row?) -> Void = { _ in },
        awaited: Row? = nil,
    ) {
        _selection = selection
        self.pointed = pointed
        self.pick = pick
        self.awaited = awaited
    }
}
