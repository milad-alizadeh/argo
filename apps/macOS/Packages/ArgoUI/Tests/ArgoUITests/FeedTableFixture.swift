import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// A real feed table, laid out and measured, for the suites whose claim is about geometry rather
/// than about a projection. Nothing here is a stand-in: the coordinator, its scroll view and its
/// `NSTableView` are the ones the deck builds, because a fake height cache would agree with
/// whatever the test expected.
@MainActor enum FeedTableFixture {
    /// A coordinator showing `rows`, sized as a deck column and laid out — so every row has been
    /// measured and the document has a height.
    ///
    /// The handle comes from the caller because the coordinator holds it weakly, as the deck's
    /// does.
    static func laidOut(
        _ rows: [FeedRow],
        in size: CGSize,
        through handle: FeedTableHandle,
        held: FeedRow.ID? = nil,
    )
        -> FeedTableCoordinator {
        laidOut(
            rows,
            in: size,
            keeping: Kept(handle: handle, geometry: FeedGeometry()),
            held: held,
        )
    }

    /// What the shell holds across a table being destroyed and built again: the scroll authority
    /// and the measured heights. One value because the deck hands the coordinator both, and
    /// because a suite that kept only one of them would be measuring a case the app never has.
    struct Kept {
        let handle: FeedTableHandle
        let geometry: FeedGeometry
    }

    /// The same table, opening onto whatever the shell was already holding — which is what a room
    /// switch does: `FeedTable.bind(_:through:)` hands the heights in before the first `apply`.
    static func laidOut(
        _ rows: [FeedRow],
        in size: CGSize,
        keeping kept: Kept,
        held: FeedRow.ID? = nil,
    )
        -> FeedTableCoordinator {
        let coordinator = FeedTableCoordinator()
        let scroller = coordinator.makeScrollView()
        scroller.frame = NSRect(origin: .zero, size: size)
        coordinator.table?.frame = scroller.frame
        coordinator.handle = kept.handle
        kept.handle.coordinator = coordinator
        coordinator.keep(kept.geometry)
        coordinator.apply(model(showing: rows, held: held))
        scroller.layoutSubtreeIfNeeded()
        return coordinator
    }

    /// Another reading arriving in the SAME table — what a Session switch is now that the deck no
    /// longer carries `.id(session)`. The store is swapped first, exactly as `FeedTable.bind` does,
    /// so the coordinator holds the fresh reading's heights before it is handed its rows.
    /// `async` because the opening scroll is: `FeedTableCoordinator.place()` claims it now and
    /// lands it over the next few turns of the run loop, so a synchronous caller would read the
    /// offset of the reading that left.
    static func show(
        _ rows: [FeedRow],
        of reading: FeedReading,
        on coordinator: FeedTableCoordinator,
        keeping geometries: FeedGeometries,
    ) async {
        coordinator.keep(geometries.geometry(for: reading))
        coordinator.apply(model(showing: rows, of: reading))
        coordinator.scroller?.layoutSubtreeIfNeeded()
        for _ in 0 ... FeedTableCoordinator.panePasses {
            try? await Task.sleep(for: .milliseconds(1))
        }
    }

    /// A frame change as AppKit posts it — the seam the deck's ONE frame observer is registered
    /// at, the feed's on the clip view.
    static func postFrameChange(on view: NSView) {
        NotificationCenter.default.post(name: NSView.frameDidChangeNotification, object: view)
    }

    /// The reading reporting its own frame, from the seam AppKit reports it at — what the lane's
    /// second frame observer used to hear as a notification (#971).
    static func reportReshape(on coordinator: FeedTableCoordinator) throws {
        let reshaped = try #require(coordinator.table?.reshaped)
        reshaped()
    }

    /// The model the table is applied, with everything the deck owns left inert: these suites open
    /// no row and follow nothing. Also the way a suite grows the reading under a table that is
    /// already laid out — and `unfolded` is the one thing they do drive, because applying a second
    /// model that names a prompt IS how the reader lets its fold out.
    static func model(
        showing rows: [FeedRow],
        unfolded: Set<FeedRow.ID> = [],
        of reading: FeedReading = .unattached,
        held: FeedRow.ID? = nil,
    )
        -> FeedTableModel {
        let focus = FocusState<FeedFocus?>()
        return FeedTableModel(
            reading: reading,
            rows: rows,
            selection: FeedRowSelection(
                open: .constant(nil), step: .constant(nil), lit: .constant(nil),
                focus: focus.projectedValue,
            ),
            held: held,
            isResizing: false,
            isUnderComposer: false,
            washed: nil,
            unfolded: .constant(unfolded),
            environment: FeedCellEnvironment(),
        )
    }
}
