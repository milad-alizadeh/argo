import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// A real feed table, laid out and measured, for the suites whose claim is about geometry rather
/// than about a projection. Nothing here is a stand-in: the coordinator, its scroll view and its
/// `NSTableView` are the ones the deck builds, because a fake height cache would agree with
/// whatever the test expected.
@MainActor enum FeedTableFixture {
    /// A coordinator showing `rows`, sized as a deck column, laid out and SETTLED — so every row
    /// has a final height and the document has one too.
    ///
    /// `async` because the measure is: the whole document is measured off the main actor before a
    /// row of it is drawn (ADR-0030, Rule 3), so a caller that did not wait would be asserting over
    /// an empty table. That is the shipped path and not a testing convenience — the deck itself
    /// stands in `FeedVacancy.unread` for exactly this span.
    ///
    /// The handle comes from the caller because the coordinator holds it weakly, as the deck's
    /// does.
    static func laidOut(
        _ rows: [FeedRow],
        in size: CGSize,
        through handle: FeedTableHandle,
        held: FeedRow.ID? = nil,
    ) async
        -> FeedTableCoordinator {
        await laidOut(
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
    static func mounting(
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
        holdOn(scroller)
        return coordinator
    }

    /// The same table with its first document already on screen, which is what a laid-out reading
    /// means since ADR-0030. Everything but the two suites whose subject is the MOUNT itself wants
    /// this one.
    static func laidOut(
        _ rows: [FeedRow],
        in size: CGSize,
        keeping kept: Kept,
        held: FeedRow.ID? = nil,
    ) async
        -> FeedTableCoordinator {
        let coordinator = mounting(rows, in: size, keeping: kept, held: held)
        await settled(coordinator)
        return coordinator
    }

    /// One scroll view kept for the run.
    ///
    /// `FeedTableCoordinator` holds its scroll view and its table WEAKLY — SwiftUI owns them in the
    /// app — and the measure the table opens on is AWAITED, which drains the autorelease pool that
    /// was keeping them alive. A fixture that let them go would suspend at its first `await` and
    /// wake up over nothing, with every claim below passing over an empty table.
    ///
    /// Held here rather than handed back, so the twenty suites that take a coordinator do not each
    /// have to keep one; bounded by the number of tables the suite builds, which is a few hundred.
    private static func holdOn(_ scroller: NSScrollView) {
        held.append(scroller)
    }

    private static var held: [NSScrollView] = []

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
        await settled(coordinator)
        for _ in 0 ... FeedTableCoordinator.panePasses {
            try? await Task.sleep(for: .milliseconds(1))
        }
    }

    /// The whole-document pass run to completion.
    ///
    /// A table draws no row until one lands (ADR-0030, Rule 3), so a suite that asserted straight
    /// after `laidOut` would be asserting over an empty table. Awaited rather than slept through:
    /// the pass is a `Task` the coordinator holds, and a landing may start another — a warm of the
    /// faces it could not measure off the main actor, or a stamp that moved while it ran.
    static func settled(_ coordinator: FeedTableCoordinator) async {
        // A table that already HAS a document is laid out first: the width a pass measures across
        // is the table's own, and a suite that moved the scroll view has not moved the table until
        // something lays it out — so a pass armed before that measures a width the reader has
        // already left, and lands a document the next layout immediately owes another.
        //
        // A table with no document is not, because there is nothing to lay out: a mount that laid
        // out an empty table would spend a pass on it, and what a mount COSTS is a claim another
        // suite makes (`FeedMountCostTests`).
        if coordinator.geometry.isSettled {
            coordinator.scroller?.layoutSubtreeIfNeeded()
        }
        await coordinator.measured()
        coordinator.scroller?.layoutSubtreeIfNeeded()
        // The opening scroll is claimed on the turn the document lands and re-aimed across a few
        // more — see `FeedTableCoordinator.place()`.
        for _ in 0 ... FeedTableCoordinator.panePasses * 2 {
            try? await Task.sleep(for: .milliseconds(2))
        }
        coordinator.scroller?.layoutSubtreeIfNeeded()
    }

    /// How many landings one wait follows through. Two would do — a pass, and the warm behind it —
    /// and a handful keeps a suite that drives a reading in several steps from having to know.
    private static let settlePasses = 8

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
