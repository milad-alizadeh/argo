import AppKit
@testable import ArgoUI
import SwiftUI

/// A real feed table, laid out and measured, for the suites whose claim is about geometry rather
/// than about a projection. Nothing here is a stand-in: the coordinator, its scroll view and its
/// `NSTableView` are the ones the deck builds, because a fake height cache would agree with
/// whatever the test expected.
@MainActor enum FeedTableFixture {
    /// A coordinator showing `rows`, sized as a deck column and laid out — so every row has been
    /// measured and the document has a height.
    ///
    /// The handle comes from the caller because the coordinator holds it weakly, as the deck's
    /// does:
    /// a fixture that owned it would keep alive what the running app lets go.
    static func laidOut(
        _ rows: [FeedRow],
        in size: CGSize,
        through handle: FeedTableHandle,
    )
        -> FeedTableCoordinator {
        let coordinator = FeedTableCoordinator()
        let scroller = coordinator.makeScrollView()
        scroller.frame = NSRect(origin: .zero, size: size)
        coordinator.table?.frame = scroller.frame
        coordinator.handle = handle
        handle.coordinator = coordinator
        coordinator.apply(model(showing: rows))
        scroller.layoutSubtreeIfNeeded()
        return coordinator
    }

    /// The model the table is applied, with everything the deck owns left inert: these suites open
    /// no row, fold nothing and follow nothing. Also the way a suite grows the reading under a
    /// table that is already laid out.
    static func model(showing rows: [FeedRow]) -> FeedTableModel {
        let focus = FocusState<FeedFocus?>()
        return FeedTableModel(
            rows: rows,
            selection: FeedRowSelection(
                open: .constant(nil), step: .constant(nil), lit: .constant(nil),
                focus: focus.projectedValue,
            ),
            held: nil,
            isResizing: false,
            isUnderComposer: false,
            washed: nil,
            unfolded: .constant([]),
            environment: EnvironmentValues(),
        )
    }
}
