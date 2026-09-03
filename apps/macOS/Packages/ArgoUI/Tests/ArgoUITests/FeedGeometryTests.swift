import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// What a room switch costs, and what it is allowed to keep (#858).
///
/// `InstrumentDeckShell` draws each room in its own `switch` arm, so leaving the Sessions room
/// destroys the feed's table and coming back builds a new one. Every height it then asked for was
/// a full SwiftUI layout against the ruler, and there were ~300 of them per return over a
/// transcript of any length — 0.12–0.16 s of thread CPU a visit, release-built.
///
/// Counted in measurements and not in seconds, for `CostMeasure`'s reason: the rows a pass had to
/// measure IS the cost, and a wall clock on a shared machine measures the machine. The cases below
/// the first two are the other half of the claim — every way a kept document could be a lie.
@Suite("Feed geometry across a switch")
@MainActor
struct FeedGeometryTests {
    /// Longer than the pane can hold several times over, so an entry costs what a real reading
    /// costs rather than a handful of visible rows.
    private static let rows = (0 ..< 400).map {
        FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
    }

    /// The same Session read another way — what the Agents rail's scope does. Same count, same
    /// indices, different rows.
    private static let scoped = rows.map {
        FeedRow(id: $0.id, content: .message("Another reading entirely, row \($0.id)."))
    }

    /// A reading with far less in it than `rows`, for the claim about what a switch stops holding.
    private static let short = Array(rows.prefix(10))

    private static let pane = CGSize(width: 460, height: 300)

    /// The gate. A reader who steps into the Tickets room and back has changed nothing about any
    /// row, so the return may not pay for a single measurement — and before this it paid for all
    /// of them.
    @Test
    func `coming back to a room measures nothing again`() async throws {
        let kept = Self.kept()
        let opened = try await Self.entered(kept)
        #expect(opened.table.measurements > 0)

        let returned = try await Self.entered(kept)

        #expect(returned.table.measurements == 0)
    }

    /// That what is kept is genuinely USED, not merely held: a table answering from an empty store
    /// would satisfy the count above by measuring nothing and drawing no row at all.
    @Test
    func `the reading comes back at the height it was measured at`() async throws {
        let kept = Self.kept()
        let opened = try await Self.entered(kept)
        let stood = try Self.rowHeights(of: opened)

        let returned = try await Self.entered(kept)

        // Real rows, not an empty table: a store that kept nothing would agree with itself across
        // the switch by drawing nothing on both sides of it.
        #expect(stood.count == Self.rows.count)
        #expect(try Self.rowHeights(of: returned) == stood)
    }

    /// Every row's height, asked for — and every one of them, because a settled document holds a
    /// final height for the rows nobody has scrolled to as much as for the ones on screen.
    private static func rowHeights(of entered: Entered) throws -> [CGFloat] {
        let table = try #require(entered.table.table)
        return (0 ..< table.numberOfRows).map { table.rect(ofRow: $0).height }
    }

    /// A height is a fact about a row's content AT A WIDTH. The reader who drags the sidebar while
    /// in another room comes back to a column of a different measure, and every height taken at the
    /// old one is wrong.
    @Test
    func `a width the reading was never measured at keeps nothing`() async throws {
        let kept = Self.kept()
        _ = try await Self.entered(kept)
        let wider = CGSize(width: Self.pane.width + 120, height: Self.pane.height)

        let returned = try await Self.entered(kept, in: wider)

        #expect(returned.table.measurements > 0)
    }

    /// The other thing a whole document is a fact about — see
    /// `FeedCellEnvironment.reInks(against:)`.
    /// A pass fact rather than a row's, so a type-size flip is a re-wrap of the whole reading and
    /// never a list of rows.
    @Test
    func `a re-ink is a re-wrap of the whole reading`() async throws {
        let settled = try #require(await Self.document(of: Self.rows))
        var reinked = FeedTableFixture.model(showing: Self.rows)
        reinked.environment.dynamicTypeSize = .accessibility3

        let delta = FeedMeasureDelta.between(settled, and: Self.stamp(of: reinked))

        #expect(delta == .whole)
    }

    /// The rows re-numbering under a table that is still standing: a row's id IS its index, so a
    /// reading with the same width and ink but DIFFERENT rows — the Agents rail scoping the feed
    /// onto a Subagent, or a transcript rewritten rather than appended to — must not come back at
    /// the heights of whatever stood at those indices.
    ///
    /// Every row of it, and named row by row rather than `whole`: the document that stands is
    /// still a document, so the reader goes on seeing the reading they had until the fresh one is
    /// measured. `whole` is the re-wrap, where not one height is true of anything.
    @Test
    func `a reading that re-numbers its rows keeps nothing`() async throws {
        let settled = try #require(await Self.document(of: Self.rows))

        let delta = FeedMeasureDelta.between(settled, and: Self.stamp(of: Self.scoped))

        #expect(delta == .rows(IndexSet(Self.rows.indices)))
    }

    /// The same claim across the switch: a reader who comes back to a reading that re-projected
    /// while they were away pays for it rather than drawing it at the old heights.
    @Test
    func `a reading that re-numbered while the reader was away is measured again`() async throws {
        let kept = Self.kept()
        _ = try await Self.entered(kept)

        let returned = try await Self.entered(kept, showing: Self.scoped)

        #expect(returned.table.measurements > 0)
    }

    /// A live transcript rewrites its last row as the call in it is answered, and the reader is not
    /// watching while they are in another room. That row is the ONE thing the return pays for —
    /// the in-place replacement ADR-0030 Rule 5 names, and the whole of what it may touch.
    @Test
    func `a row rewritten while the reader was away is measured again`() async throws {
        let settled = try #require(await Self.document(of: Self.rows))
        var grown = Self.rows
        grown[grown.count - 1] = FeedRow(
            id: grown.count - 1,
            content: .message(String(repeating: "It grew while nobody watched. ", count: 40)),
        )

        let delta = FeedMeasureDelta.between(settled, and: Self.stamp(of: grown))

        #expect(delta == .rows(IndexSet(integer: grown.count - 1)))
    }

    /// A prompt the reader unfolded is folded again by the switch — `FeedView.unfolded` is deck
    /// state and the deck is destroyed — so the row draws short. Its height goes with it, or the
    /// reading comes back with a folded prompt standing in an unfolded row's space.
    @Test
    func `a fold is part of what a height is true of`() async throws {
        let settled = try #require(await Self.document(of: Self.rows))
        let unfolded = FeedTableFixture.model(showing: Self.rows, unfolded: [Self.rows[1].id])

        let delta = FeedMeasureDelta.between(settled, and: Self.stamp(of: unfolded))

        #expect(delta == .rows(IndexSet(integer: 1)))
    }

    /// A survey draws one line per call while it is the open row and nothing while it is not
    /// (`FeedSurveyLine`), and opening one does not change the pane's width. The row it opened on
    /// owes a measurement; nothing else in the document does.
    @Test
    func `whether a row is open is part of what a height is true of`() async throws {
        let settled = try #require(await Self.document(of: Self.rows))
        var open = FeedTableFixture.model(showing: Self.rows)
        open.selection = FeedRowSelection(
            open: .constant(Self.rows[1].id), step: .constant(nil), lit: .constant(nil),
            focus: open.selection.focus,
        )

        let delta = FeedMeasureDelta.between(settled, and: Self.stamp(of: open))

        #expect(delta == .rows(IndexSet(integer: 1)))
    }

    /// Nothing is remembered longer than the reading on screen, which is the whole bound on what
    /// this costs in memory. A long reading, then a short one: the entries the short one cannot
    /// name are gone, or a Session with ten rows would hold the previous one's four hundred for the
    /// life of the window.
    @Test
    func `a shorter reading does not go on holding the longer one's heights`() async throws {
        let kept = Self.kept()
        _ = try await Self.entered(kept)
        #expect(kept.geometry.count > Self.short.count)

        _ = try await Self.entered(kept, showing: Self.short)

        #expect(kept.geometry.count <= Self.short.count)
    }

    /// One settled document over `rows`, measured the way the table measures one.
    private static func document(of rows: [FeedRow]) async -> FeedSettledDocument? {
        await FeedMeasurePass.settle(stamp(of: rows))
    }

    private static func stamp(of rows: [FeedRow]) -> FeedMeasureStamp {
        stamp(of: FeedTableFixture.model(showing: rows))
    }

    private static func stamp(of model: FeedTableModel) -> FeedMeasureStamp {
        FeedMeasureStamp(of: model, atWidth: pane.width)
    }

    private static func kept(sharing geometry: FeedGeometry = FeedGeometry())
        -> FeedTableFixture.Kept {
        FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: geometry)
    }

    /// One entry into the Sessions room. The scroller comes back with the coordinator because the
    /// coordinator holds it WEAKLY — SwiftUI owns the view in the running app, and a case that let
    /// it go would be asserting over a table that no longer exists.
    private static func entered(
        _ kept: FeedTableFixture.Kept,
        in pane: CGSize = pane,
        showing rows: [FeedRow] = rows,
    ) async throws
        -> Entered {
        let table = await FeedTableFixture.laidOut(rows, in: pane, keeping: kept)
        return try Entered(scroller: #require(table.scroller), table: table)
    }

    private struct Entered {
        let scroller: NSScrollView
        let table: FeedTableCoordinator
    }
}
