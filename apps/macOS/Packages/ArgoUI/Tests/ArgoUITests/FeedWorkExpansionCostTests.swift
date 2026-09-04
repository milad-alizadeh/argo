import AppKit
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What EXPANDING a card of a Turn's work costs (#1172, ADR-0028 Rule 2, ADR-0030 Rule 5).
///
/// A card expands in place: the row lists what it folded and grows, and everything below it moves.
/// That is the "one row replaced" path, which exists and is measured — so this gates that the
/// press takes it, rather than retiring the document and re-measuring the reading.
///
/// Counted in measurements, which is what one full SwiftUI layout pass IS. A card far down a
/// reading that re-measured the whole document would read that document's length here.
@Suite("Feed work expansion cost", .serialized)
@MainActor
struct FeedWorkExpansionCostTests {
    private static let pane = CGSize(width: ArgoFeedRow.column, height: 500)

    /// The dense Turn eight times over, so the card the case expands sits well down the document —
    /// a card at the head of a short reading would pass this with everything re-measured.
    private static let rows = FeedProjection.rows(
        from: (0 ..< 8).flatMap { _ in TranscriptFixtures.denseTurn },
    )

    @Test
    func `expanding a card measures that row and no other`() async throws {
        let card = try #require(Self.rows.last { row in
            guard case .work = row.content else { return false }
            return true
        })
        #expect(card.id > 100, "the fixture stopped putting a card far enough down the reading")

        let coordinator = await FeedTableFixture
            .laidOut(Self.rows, in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(coordinator)
        let table = try #require(coordinator.table)
        let closed = coordinator.measuredHeight(at: card.id, in: table)
        let before = coordinator.measurements

        coordinator.apply(FeedTableFixture.model(showing: Self.rows, unfolded: [card.id]))
        await FeedTableFixture.settled(coordinator)

        #expect(coordinator.measurements - before == 1)
        #expect(coordinator.measuredHeight(at: card.id, in: table) > closed)
    }
}
