import AppKit
@testable import ArgoUI
import Testing

/// A room switch, through the REAL view tree: `InstrumentDeckShell` keeps every room mounted and
/// gates each with `.room(isActive:)` rather than a `switch` that gives the branch left behind a
/// fresh identity (#1356). This is the one claim `KeptDeckSurvivalTests` cannot make on its own —
/// that suite rebuilds `FeedDeckStack` by hand to model what a room switch used to cost the feed;
/// this one drives the shell's own `room` and asks whether the feed's `NSTableView` ever came down
/// at all.
@Suite("Room round trip, hosted", .serialized)
@MainActor
struct RoomRoundTripTests {
    /// Leaving the Sessions room and coming back must not tear down the feed's table: the same
    /// `NSTableView` instance is still there, at the same scroll offset, with nothing remeasured.
    @Test(.enabled(if: WindowedTests.areAvailable))
    func `a room round trip leaves the feed table's identity, offset and measurements untouched`(
    ) async throws {
        let deck = HostedDeck()
        await deck.settled()
        let table = try deck.table
        let coordinator = try deck.coordinator
        let offsetBefore = coordinator.offset()
        let measurementsBefore = coordinator.measurements

        await deck.show(.atlas)
        await deck.show(.sessions)

        #expect(try deck.table === table)
        #expect(try deck.coordinator === coordinator)
        #expect(coordinator.offset() == offsetBefore)
        #expect(coordinator.measurements == measurementsBefore)
    }
}
