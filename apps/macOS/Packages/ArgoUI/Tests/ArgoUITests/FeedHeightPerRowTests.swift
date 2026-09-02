import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// One row, one height — and the lane mapping the document the table scrolls through.
///
/// `FeedRowHeightTests` beside it is the CEILING on one row's height; this is the store that files
/// them, and which row each is a fact about.
///
/// A Session is drawn twice. The roster reads a bounded excerpt of each transcript — its head, its
/// tail, and a seam where the middle is missing (`TranscriptExcerpt`) — and selecting one reads the
/// file whole a moment later, which re-numbers every row the excerpt already had.
///
/// #1097 filed each height under a `Ground` — the row's content, the content above it, its fold,
/// whether it is open, whether it draws its Turn's copy chip — so that a re-numbered row kept the
/// height it already had. That key is not unique per drawn row: a reading in which two rows say the
/// same words under the same kind of row holds ONE entry for both. Measured against the live
/// registry it was routinely short — 311 entries for 313 rows, 1,709 for 1,757 — and the reading
/// that comes back is then a document whose height is a fact about a different set of rows than the
/// one on screen. The feed drew blank, or with a several-hundred-point hole in it, and the lane
/// mapped a document the table was not scrolling through (#1100).
///
/// So the store is keyed by the row's INDEX again, with the ground beside it as a guard. These are
/// the claims that keying is FOR, which is why they live together rather than beside the switch
/// cost in `FeedGeometryTests`.
@Suite("Feed heights, one per row")
@MainActor
struct FeedHeightPerRowTests {
    /// One Session, read twice. The same reading both times — this is an arrival, not a switch.
    private static let session = FeedReading(session: "excerpted")

    /// A reading whose rows REPEAT, which is what a real one does: the same command run twice, the
    /// same short answer given twice. Cycled over four lines rather than numbered, so a store keyed
    /// on what a row says cannot tell one of them from the next.
    private static let repeated = (0 ..< 60).map {
        FeedRow(id: $0, content: .message(Self.said[$0 % Self.said.count]))
    }

    private static let said = [
        "Done.", "Green.", "Read what is there before changing any of it.", "Done.",
    ]

    /// The whole transcript as the feed draws it, every row distinct.
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

    /// The gate #1097 could not meet. A height is a fact about ONE row, so a reading of sixty rows
    /// stands on sixty of them — however many of those rows say the same words under the same kind
    /// of row. A store one entry short is a store answering one row with another's height.
    @Test
    func `rows that say the same words each hold a height of their own`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(Self.repeated, of: Self.session)
        _ = try Self.read(deck)

        #expect(deck.coordinator.geometry.count == Self.repeated.count)
    }

    /// The same claim one scope down, where it can be asked without a table: rows 1 and 5 of that
    /// reading say the same words under the same words, and are still two questions. The second has
    /// no answer until it has been measured itself.
    @Test
    func `a height recorded for one row answers for that row alone`() {
        let geometry = FeedGeometry()
        let model = FeedTableFixture.model(showing: Self.repeated)
        #expect(Self.repeated[1].content == Self.repeated[5].content)

        geometry.record(120, at: 1, under: FeedGeometry.Ground(at: 1, of: model))

        #expect(geometry.height(at: 1, under: FeedGeometry.Ground(at: 1, of: model)) == 120)
        #expect(geometry.height(at: 5, under: FeedGeometry.Ground(at: 5, of: model)) == nil)
    }

    /// The heights a reading that came through an excerpt stands at are the heights a cold one
    /// does — per ROW, because a total that agreed over rows that did not would put every mark in
    /// the lane beside a row it does not stand for.
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

        let stood: [CGFloat] = warm.rows.map(\.height)
        let fresh: [CGFloat] = cold.rows.map(\.height)
        #expect(stood == fresh)
    }

    /// The thumb rides the same document the table scrolls through. `MinimapGeometry` sums the
    /// per-row heights the lane was handed; `NSTableView` sums the ones it asked the delegate for.
    /// Where those two disagree the reader drags a thumb that does not correspond to where the
    /// reading is, which is the first of #1100's three symptoms.
    ///
    /// The end of the scroll is asked as well as the total, because that is what the reader
    /// actually checks: the reading at its last scrollable offset puts the thumb flush with the
    /// lane's foot, and a lane that had mapped a taller document would leave it short.
    ///
    /// A guard rather than the gate — both sides are sums over the same store, so this agrees
    /// whatever the store is keyed BY. It is here because the symptom was reported against the
    /// lane, and because the arithmetic between them is not otherwise held anywhere.
    @Test
    func `the lane maps the document the table scrolls through`() async throws {
        let deck = FeedSwitchDeck()
        await deck.show(Self.repeated, of: Self.session)
        let reading = try Self.read(deck)
        let lane = MinimapGeometry(reading, lane: CGSize(width: 60, height: 300))
        let document = try #require(deck.scroller?.documentView?.frame.height)
        #expect(abs(lane.documentHeight - document) < 0.5)

        #expect(lane.isScrollable)
        let foot = lane.viewportY(at: lane.offsetRange.upperBound) + lane.viewportHeightInLane
        #expect(abs(foot - min(lane.lane.height, lane.miniatureHeight)) < 0.5)
    }

    /// The reading the overview lane takes, which is the one caller that asks for EVERY row's
    /// height — so taking it is what measures the whole document rather than the screenful of it
    /// the table realised.
    private static func read(_ deck: FeedSwitchDeck) throws -> MinimapReading {
        try #require(deck.coordinator.reading())
    }
}
