import AppKit
@testable import ArgoUI
import Testing

/// A press on a fold moves the rows below it ONCE, to their final place (#1691).
///
/// The jitter was the hop. `touchUp` redraws the pressed cell in its open shape inside the very
/// `apply` the press arrives on, while the height it needs was owed to a `Task`: for that hop the
/// rows below stood at the closed height, and they stepped down when the pass landed. Nothing is
/// awaited anywhere below, which is the claim — a fold is a handful of arithmetic heights, so the
/// content and the geometry land in one turn of the main actor.
@MainActor
@Suite("Feed folds settle in the turn of the press")
struct FeedFoldSettleTests {
    private static let column = CGSize(width: ArgoFeedRow.column, height: 800)

    /// A card of work with a row under it — the rows below are what the reader sees move.
    private static let rows = [
        FeedRow(id: 0, content: .work(RowKindFixture.work)),
        FeedRow(id: 1, content: .message("That is the lot of it")),
    ]

    private static func opened(_ unfolded: Set<FeedRow.ID>) -> FeedTableModel {
        FeedTableFixture.model(showing: rows, unfolded: unfolded)
    }

    @Test
    func `the card the press opened is its open height before anything is awaited`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(
            Self.rows, in: Self.column, through: handle,
        )
        let table = try #require(coordinator.table)
        let closed = coordinator.tableView(table, heightOfRow: 0)
        coordinator.apply(Self.opened([0]))
        let opened = coordinator.tableView(table, heightOfRow: 0)
        #expect(opened > closed)
        await FeedTableFixture.settled(coordinator)
        #expect(coordinator.tableView(table, heightOfRow: 0) == opened)
    }

    /// The row below stands where it will stand, on the turn of the press. Two answers that differ
    /// is the step the reader sees.
    @Test
    func `the row below the card moves once, to the place it settles at`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(
            Self.rows, in: Self.column, through: handle,
        )
        let table = try #require(coordinator.table)
        let closed = table.rect(ofRow: 1).minY
        coordinator.apply(Self.opened([0]))
        let opened = table.rect(ofRow: 1).minY
        #expect(opened > closed)
        await FeedTableFixture.settled(coordinator)
        #expect(table.rect(ofRow: 1).minY == opened)
    }

    /// Closing it is the same event backwards, and it settled the same way.
    @Test
    func `closing the card puts the row below back in one step`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(
            Self.rows, in: Self.column, through: handle,
        )
        coordinator.apply(Self.opened([0]))
        await FeedTableFixture.settled(coordinator)
        let table = try #require(coordinator.table)
        let opened = table.rect(ofRow: 1).minY
        coordinator.apply(Self.opened([]))
        let closed = table.rect(ofRow: 1).minY
        #expect(closed < opened)
        await FeedTableFixture.settled(coordinator)
        #expect(table.rect(ofRow: 1).minY == closed)
    }

    /// And the lane beside it never goes absent for a press. A deck that owes a measure is
    /// PROVISIONAL, which is what makes the overview lane hold the reading it last drew instead of
    /// mapping the one on screen (ADR-0030, Rule 7) — for exactly the hop the pass would take.
    @Test
    func `a press on a fold never puts the lane in its provisional state`() async {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(
            Self.rows, in: Self.column, through: handle,
        )
        coordinator.apply(Self.opened([0]))
        #expect(coordinator.readingStamp()?.isProvisional == false)
    }

    /// A prompt is the fold that must NOT come this way. Its open height is typeset rather than
    /// counted (`FeedShapeHeight.bubble`), and Core Text on the main actor inside the press is the
    /// work ADR-0030 Rules 1 and 3 moved off it — so the press keeps the pass, and the height still
    /// lands.
    @Test
    func `a press on a prompt keeps the measure pass`() async throws {
        let long = String(repeating: "Read the whole anatomy study before you start. ", count: 14)
        let rows = [
            FeedRow(id: 0, content: .prompt(text: long, shots: [])),
            FeedRow(id: 1, content: .message("That is the lot of it")),
        ]
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(rows, in: Self.column, through: handle)
        let table = try #require(coordinator.table)
        let closed = coordinator.tableView(table, heightOfRow: 0)

        coordinator.apply(FeedTableFixture.model(showing: rows, unfolded: [0]))

        #expect(coordinator.isMeasuring)
        await FeedTableFixture.settled(coordinator)
        #expect(coordinator.tableView(table, heightOfRow: 0) > closed)
    }
}
