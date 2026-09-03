import AppKit
import ArgoDesign
import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What the lane's foot MEANS: the end of the scroll the reader actually has, not the sum of the
/// heights the document was settled at (#1132).
///
/// `MinimapGeometry.offsetRange` builds its ceiling out of `documentHeight`, the prefix sum over
/// the settled document. The reader's scroll is bounded by the table's own document view, which
/// AppKit sizes lazily off `tableView(_:heightOfRow:)` and does NOT finish sizing until something
/// asks after every row. Measured over 2 402 rows the two were 564 points apart on a fresh mount,
/// and 2 222 points apart after a widening — about fifty-five rows the reader can scroll through
/// below everything the lane maps, with the lit rectangle clamped at the foot for all of it.
/// `MinimapReading` carries no fact about the document view, so the lane cannot notice.
///
/// This is the claim `MinimapSettledDocumentTests` cannot make. Its own case asks
/// `rect(ofRow:)` for every row before asserting the height, and that walk is what forces the tile
/// that makes the assertion true — a gate that passes because of what the test did, not because of
/// what the code does. Nothing here walks the rows first.
///
/// `.serialized` for that suite's reason: these are claims about a whole table laid out to its
/// last row, and cases racing each other read a frame part-way through a tile.
@Suite("Minimap over the reader's scroll", .serialized)
@MainActor
struct MinimapScrollableHeightTests {
    private static let pane = CGSize(
        width: MinimapLaneFixture.column.width - 3, height: MinimapLaneFixture.column.height,
    )

    /// Wide, then narrow: both below `ArgoFeedRow.column`, so each is a genuine re-wrap and the
    /// document really is measured again (`FeedRewrapMeasureTests`).
    private static let narrow: CGFloat = 380
    private static let wide: CGFloat = 700

    private static func rows() async throws -> [FeedRow] {
        let lines = try SettledSessionReading.lines(of: SettledSessionFixture.synthetic)
        return await FeedProjection.rows(from: TranscriptReader().read(lines: lines))
    }

    /// The floor: a point either way over a document of tens of thousands of points. Anything the
    /// reader could scroll through is a mark in the wrong place.
    private static let slack: CGFloat = 1

    /// A fresh mount, asked nothing else first.
    @Test
    func `the table is as tall as the document it settled on`() async throws {
        let table = try await FeedTableFixture
            .laidOut(Self.rows(), in: Self.pane, through: FeedTableHandle())
        let document = try #require(table.geometry.settled)
        let drawn = try #require(table.table)

        #expect(abs(drawn.frame.height - document.totalHeight) <= Self.slack)
    }

    /// A live Session appending rows — the ordinary case for a Session being watched.
    ///
    /// This is the case that says the walk may not be shortened to the rows that changed. Starting
    /// at the first moved height looks sound, since everything above it was converged by the
    /// landing before; it is not, because `show` reloads and a reload drops AppKit's row cache
    /// wholesale. Measured that way, a twelve-row append left the table 8 819pt short of its own
    /// document.
    @Test
    func `a reading that grew is as tall as the document it grew into`() async throws {
        let rows = try await Self.rows()
        let table = await FeedTableFixture
            .laidOut(rows, in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(table)

        let grown = rows + (0 ..< 12).map {
            FeedRow(id: rows.count + $0, content: .message(
                "A line of prose long enough to wrap the reading measure, arriving \($0).",
            ))
        }
        table.apply(FeedTableFixture.model(showing: grown))
        await FeedTableFixture.settled(table)

        let document = try #require(table.geometry.settled)
        let drawn = try #require(table.table)
        #expect(document.stamp.rows.count == grown.count)
        #expect(abs(drawn.frame.height - document.totalHeight) <= Self.slack)
    }

    /// And a row REWRITTEN in the middle, which moves a height with nothing appended after it —
    /// the rows below it all shift, and the table has to end up as tall as the document says.
    @Test
    func `a row rewritten in the middle leaves the table as tall as its document`() async throws {
        let rows = try await Self.rows()
        let table = await FeedTableFixture
            .laidOut(rows, in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(table)

        var answered = rows
        let at = answered.count / 2
        answered[at] = FeedRow(
            id: answered[at].id,
            content: .message(String(repeating: "The Result arrived, and it is long. ", count: 30)),
        )
        table.apply(FeedTableFixture.model(showing: answered))
        await FeedTableFixture.settled(table)

        let document = try #require(table.geometry.settled)
        let drawn = try #require(table.table)
        #expect(abs(drawn.frame.height - document.totalHeight) <= Self.slack)
    }

    /// The kept-deck path, which no pass ever lands on (#858, ADR-0030 Rule 4).
    ///
    /// A table built fresh over a `FeedGeometry` the shell kept has a whole document and has drawn
    /// none of it, so `adoptSettled` shows it without measuring anything. That is the ordinary room
    /// switch and every re-click of a Session the reader has already opened — and because no pass
    /// runs, nothing will ever correct AppKit's own row geometry afterwards. The landing's walk
    /// cannot help here: there is no landing.
    @Test
    func `a kept document adopted without a pass is as tall as itself`() async throws {
        let rows = try await Self.rows()
        let settled = await FeedTableFixture
            .laidOut(rows, in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(settled)

        let kept = FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: settled.geometry)
        let adopting = FeedTableFixture.mounting(rows, in: Self.pane, keeping: kept)
        let drawn = try #require(adopting.table)
        let document = try #require(adopting.geometry.settled)

        // The adopt branch really was taken: a pass here would make this a claim about a landing.
        #expect(adopting.measurements == 0)
        #expect(abs(drawn.frame.height - document.totalHeight) <= Self.slack)
    }

    /// And after the pane WIDENS, which is where the gap was largest and in the direction that
    /// leaves the reader scrolling below the end of the map.
    @Test
    func `a widened pane leaves nothing below the end of the lane`() async throws {
        let handle = FeedTableHandle()
        let table = try await FeedTableFixture
            .laidOut(Self.rows(), in: Self.pane, through: handle)
        let scroller = try #require(table.scroller)

        for width in [Self.narrow, Self.wide] {
            scroller.frame = NSRect(
                origin: .zero, size: CGSize(width: width, height: Self.pane.height),
            )
            table.settleAfterResize()
            await FeedTableFixture.settled(table)
        }

        let document = try #require(table.geometry.settled)
        let drawn = try #require(table.table)
        #expect(abs(drawn.frame.height - document.totalHeight) <= Self.slack)

        // And said the way the reader meets it: the end of the scroll is the end of the lane.
        let geometry = try MinimapGeometry(#require(table.reading()), lane: CGSize(
            width: ArgoLayout.minimapLaneWidth(sharing: Self.wide), height: Self.pane.height,
        ))
        let scrollable = drawn.frame.height + scroller.contentInsets.bottom
            - scroller.contentView.bounds.height
        #expect(abs(geometry.offsetRange.upperBound - scrollable) <= Self.slack)
    }
}
