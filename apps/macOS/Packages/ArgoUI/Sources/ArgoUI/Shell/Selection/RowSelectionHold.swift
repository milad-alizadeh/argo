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

    /// What the `List` itself wrote back, taken in on this hold's terms (#1493).
    ///
    /// The one route the platform's selection reaches the reader's by, so the rule about the
    /// awaited row belongs here rather than in `RowSelection`: the value knows which rows are
    /// selected, and only the hold knows which one has not been published yet.
    /// A `List` can only name rows it is DRAWING, so while a row is awaited an EMPTY write-back
    /// is the list's own arithmetic over a row it has not been given yet, never the reader letting
    /// one go. Taking it in dropped `selection.last`, and `RowSelectionReactions` reads that to
    /// repoint the deck — so the window left the Session a spawn had just started, with neither
    /// reconciliation nor the reader having any say. It is the third narrowing seam on that route,
    /// after `reconcile` and `confine`, and the last one open.
    ///
    /// A write-back that NAMES a row is the reader, including one that moves off the awaited
    /// Session, so only the empty one is refused — and only while something is awaited, which is
    /// the second or so between a spawn answering and its row arriving.
    package func absorbFromList(_ selected: Set<Row>, over visible: [Row]) {
        guard !(selected.isEmpty && awaited != nil) else { return }
        selection.absorb(selected, over: visible)
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
