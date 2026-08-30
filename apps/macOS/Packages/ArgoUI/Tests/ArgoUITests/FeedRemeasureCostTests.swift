import AppKit
@testable import ArgoUI
import Testing

/// What a full re-measure COSTS when nothing has changed, and that it still costs what it must
/// when something has.
///
/// `.all` is not a rare pass. `FeedScrollPolicy` answers it for `resizeEnded` and for every
/// `settleElapsed` — 250 ms after any burst of width notices, and a panel revealing itself is a
/// burst. It used to surrender every measured height before re-measuring, so each of those
/// re-paid a full SwiftUI layout for every row in the reading whether or not one of them had
/// moved. The heights already answer for themselves: `FeedGeometry.Ground` names the whole of what
/// a height is a fact about, and the pass facts — the width and the ink — retire the store on
/// their own (`FeedGeometry.settle(at:in:)`). So the pass NOTES and drops nothing.
///
/// Counted in measurements, never in seconds: a measurement is one full SwiftUI layout pass, and
/// the count is what the pass cost rather than what the machine was doing (`CostMeasure`).
@Suite("Feed re-measure cost")
@MainActor
struct FeedRemeasureCostTests {
    /// The row a rewrite makes taller, far enough up the reading to be off screen at the end.
    private static let rewritten = 10

    /// The settle every width burst ends in, over a reading nothing has touched since it was
    /// measured. Zero, and it has to be zero at BOTH ends — the frame it lands in and the tail
    /// behind it — because the tail is the same work served in slices.
    @Test
    func `a full re-measure of an unchanged reading measures nothing`() async throws {
        let laid = FeedSwitchDeck()
        await laid.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let measured = laid.coordinator.measurements
        #expect(measured >= FeedSwitchFixture.alphaRows.count)

        laid.coordinator.settleAfterResize()
        let inTheFrame = laid.coordinator.measurements
        try await #require(laid.coordinator.tailing).value

        #expect(inTheFrame == measured)
        #expect(laid.coordinator.measurements == measured)
    }

    /// The other half of the claim, and the reason the drop is not needed: a row whose words
    /// changed answers `nil` to the height question by itself, so a reading that came back
    /// rewritten
    /// is re-measured where it moved and nowhere else.
    ///
    /// Two rows, exactly: the one that was rewritten, and the one BELOW it — `FeedGeometry.Ground`
    /// carries the row above, because the gap above a row is inside that row's height.
    @Test
    func `a row the reading rewrote is measured again and its neighbours are not`() async throws {
        let laid = FeedSwitchDeck()
        await laid.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let table = try #require(laid.coordinator.table)
        let was = laid.coordinator.measuredHeight(at: Self.rewritten, in: table)
        await laid.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let before = laid.coordinator.measurements

        var grown = FeedSwitchFixture.alphaRows
        grown[Self.rewritten] = FeedRow(
            id: Self.rewritten,
            content: .message(
                String(repeating: "The row grew, and by more than one line. ", count: 12),
            ),
        )
        await laid.show(grown, of: FeedSwitchFixture.alpha)

        #expect(laid.coordinator.measurements - before == 2)
        #expect(laid.coordinator.measuredHeight(at: Self.rewritten, in: table) > was)
    }
}
