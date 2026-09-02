@testable import ArgoUI
import Testing

/// What selecting a Session costs the second time its rows arrive.
///
/// A Session is drawn twice. The roster reads a bounded excerpt of each transcript — its head, its
/// tail, and a seam where the middle is missing (`TranscriptExcerpt`) — and selecting one reads the
/// file whole a moment later. The two readings share their tail BYTE FOR BYTE; all that changed is
/// where those rows sit, because a row's id is its index (`FeedProjection.rows`).
///
/// Keyed by index, that arrival threw every measured height away: the rows re-numbered, so the
/// table reloaded, and the reload dropped the store. Every shared row was then re-measured for
/// nothing — a full SwiftUI layout each, and the wait a reader feels between clicking a Session and
/// seeing it. Keyed by what a height is a fact ABOUT, the re-numbering costs nothing at all.
///
/// Counted in measurements and never in seconds, for `CostMeasure`'s reason: a measurement is one
/// full layout pass, and the count is what the arrival cost rather than what the machine was doing.
@Suite("Feed excerpt cost")
@MainActor
struct FeedExcerptCostTests {
    /// One Session, read twice. The same reading both times — this is an arrival, not a switch.
    private static let session = FeedReading(session: "excerpted")

    /// The whole transcript as the feed draws it. All messages, so the reading is one Turn: the
    /// copy chip then stands on its last row and on no other, in the excerpt and in the whole
    /// alike, which is what keeps the arithmetic below about the rows and nothing else.
    private static let whole = (0 ..< 240).map {
        FeedRow(id: $0, content: .message("Excerpt line \($0), long enough to wrap the pane."))
    }

    /// Rows of the transcript's opening each end of the bounded read keeps.
    private static let head = 16
    private static let tail = 24

    /// What that bounded read leaves: the opening rows, the seam, and the newest ones — numbered
    /// densely from zero, which is how every reading the projection makes is numbered.
    private static let excerpted: [FeedRow] = {
        let content = whole.prefix(head).map(\.content)
            + [FeedRow.Content.mark(.excerpted)]
            + whole.suffix(tail).map(\.content)
        return content.enumerated().map { FeedRow(id: $0.offset, content: $0.element) }
    }()

    /// The rows the whole reading has that the excerpt did not, exactly.
    ///
    /// Its middle, which nothing has ever measured. Plus ONE: the first row of the shared tail,
    /// whose row above is the seam mark in the excerpt and a real row in the whole — and the gap
    /// above a row is inside that row's height (`FeedGeometry.Ground`). Everything else is a hit:
    /// the opening rows sit at the same indices under the same rows, and the rest of the tail moved
    /// without changing either its words or the row above it.
    private static let arriving = whole.count - head - tail + 1

    /// The gate. Not "fewer rows" — the rows the excerpt did not have, and no others.
    @Test
    func `the whole reading measures only the rows the excerpt did not have`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(Self.excerpted, of: Self.session)
        _ = try Self.read(deck)
        let measured = deck.coordinator.measurements
        // The excerpt is measured WHOLE, once a row — or "only the new rows" below would be
        // satisfied by an excerpt that had measured nothing.
        #expect(measured == Self.excerpted.count)

        await deck.show(Self.whole, of: Self.session)
        _ = try Self.read(deck)

        #expect(deck.coordinator.measurements - measured == Self.arriving)
    }

    /// And the heights that survived are the same heights, so the minimap — a miniature of the
    /// WHOLE document, built off the feed's own measured rows (`FeedTableCoordinator.reading()`) —
    /// cannot tell the two apart. Per row and in total: a document height that agreed by accident
    /// over rows that did not would put every mark in the lane beside the row it stands for.
    @Test
    func `a reading that came through an excerpt stands at the heights a cold one does`(
    ) async throws {
        let warmed = FeedSwitchDeck()
        await warmed.show(Self.excerpted, of: Self.session)
        _ = try Self.read(warmed)
        await warmed.show(Self.whole, of: Self.session)
        let warm = try Self.read(warmed)

        let colded = FeedSwitchDeck()
        await colded.show(Self.whole, of: Self.session)
        let cold = try Self.read(colded)

        #expect(warm.rows.map(\.height) == cold.rows.map(\.height))
        #expect(warm.rows.map(\.height).reduce(0, +) == cold.rows.map(\.height).reduce(0, +))
    }

    /// The reading the overview lane takes, which is the one caller that asks for EVERY row's
    /// height — so taking it is what measures the whole document rather than the screenful of it
    /// the table realised.
    private static func read(_ deck: FeedSwitchDeck) throws -> MinimapReading {
        try #require(deck.coordinator.reading())
    }
}
