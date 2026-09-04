import AppKit
import ArgoDesign
import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The lane over the settled document (ADR-0030, Rule 7; D25 as amended): one mark per row at its
/// TRUE position, and the weight cap on what is drawn inside a row's span rather than on the span.
///
/// Driven from outside at the geometry seam, over the checked-in synthetic of the largest Session
/// Argo has been given (#1117) — the shape every one of the defects ADR-0030 names showed up at.
/// A short reading compresses to nothing and agrees with anything; a 459-row one is where a mark
/// half a row out is a mark on the wrong Turn.
///
/// `.serialized` because the claims are about a 459-row table laid out to its last row. An
/// `NSTableView` tiles its document view over turns of the main actor, and four of these cases
/// racing each other read a frame part-way through that — a real number, of a table nobody has
/// finished laying out.
@Suite("Minimap over the settled document", .serialized)
@MainActor
struct MinimapSettledDocumentTests {
    /// A deck column and the lane the deck puts beside it — a compression of the shipped shape,
    /// at a width of this suite's OWN.
    ///
    /// Three points off the lane fixture's column, for `SettledSessionCostTests`' reason:
    /// `ProseMetrics` keys its wrapped answers by the measure they were taken at and the store is
    /// shared with two thousand other cases, so a 459-row walk at the width the cost suites time
    /// at would evict what they had just warmed and read as a regression in them.
    private static let pane = CGSize(
        width: MinimapLaneFixture.column.width - 3, height: MinimapLaneFixture.column.height,
    )
    private static let lane = CGSize(
        width: ArgoLayout.minimapLaneWidth(sharing: pane.width), height: pane.height,
    )

    /// The synthetic fixture as the feed reads it.
    private static func rows() async throws -> [FeedRow] {
        let lines = try SettledSessionReading.lines(of: SettledSessionFixture.synthetic)
        return await FeedProjection.rows(from: TranscriptReader().read(lines: lines))
    }

    /// The whole claim, said as arithmetic: the lane's prefix sums ARE the settled document's, so a
    /// mark cannot stand anywhere but at the head of the row it is a mark for.
    @Test
    func `every mark stands at its row's own offset in the settled document`() async throws {
        let rows = try await Self.rows()
        #expect(rows.count > 400, "the fixture stopped being the largest Session's shape")
        let handle = FeedTableHandle()
        let table = await FeedTableFixture.laidOut(rows, in: Self.pane, through: handle)
        let document = try #require(table.geometry.settled)
        let geometry = try MinimapGeometry(#require(table.reading()), lane: Self.lane)

        // And the scroller places its rows at those very offsets. A lane whose prefix sums agreed
        // with the document but not with the table would map a session nobody is scrolling, which
        // is the disagreement between the map and the scroll ratio ADR-0030 was written about.
        let drawn = try #require(table.table)
        var offset: CGFloat = 0
        for index in rows.indices {
            #expect(geometry.documentY(row: index) == offset)
            // Within a thousandth of a point: AppKit sums the rows itself, and forty thousand
            // points of double addition ends a hundred-billionth out. The lane's own floor is a
            // whole point, so nothing this side of it is a mark in the wrong place.
            #expect(abs(drawn.rect(ofRow: index).minY - offset) < 0.001)
            offset += try #require(document.height(at: index))
        }
        #expect(geometry.documentHeight == document.totalHeight)
        #expect(drawn.frame.height.rounded() == document.totalHeight.rounded())
    }

    /// The tail is reachable from the lane, which is user story 4's half of this lane: the foot of
    /// the lane means the foot of the reading, and the foot of the reading has the last row on
    /// screen.
    @Test
    func `the foot of the lane lands on the end of the reading`() async throws {
        let rows = try await Self.rows()
        let handle = FeedTableHandle()
        let table = await FeedTableFixture.laidOut(rows, in: Self.pane, through: handle)
        let document = try #require(table.geometry.settled)
        let geometry = try MinimapGeometry(#require(table.reading()), lane: Self.lane)

        let landed = geometry.offset(forLaneY: Self.lane.height)

        #expect(landed == geometry.offsetRange.upperBound)
        // The last row's head is inside what the landing puts on screen, so the row itself is in
        // view rather than one point past it.
        let last = geometry.documentY(row: rows.count - 1)
        #expect(last >= landed)
        #expect(last < landed + Self.pane.height)
        #expect(landed + Self.pane.height >= document.totalHeight)

        // And the wash the reader sees for that landing is flush with the lane's foot, which is
        // how the lane SAYS the tail has been reached.
        #expect(
            abs(geometry.viewportY(at: landed)
                - (Self.lane.height - geometry.viewportHeightInLane)) < 1,
        )
    }

    /// D25's weight cap, as ADR-0030 leaves it: the cap is the row's own settled extent, and it
    /// binds on BOTH sides.
    ///
    /// No mark may leave the row it belongs to — a row that reports more than the feed drew would
    /// otherwise put ink over the row below it. And no row may be drawn SHORT of its extent, which
    /// is the failure the 2026-08-12 amendment names: the old per-event ceiling "cut a long
    /// message's block at its head and left the rest of its span as dead lane". Asserting only the
    /// first would pass a reinstated ceiling.
    ///
    /// Over the whole synthetic document rather than a case built to make the point, so a row
    /// shape nobody thought of is inside the claim too.
    @Test
    func `every mark fills its row's span and none of it leaves that row`() async throws {
        let rows = try await Self.rows()
        let handle = FeedTableHandle()
        let table = await FeedTableFixture.laidOut(rows, in: Self.pane, through: handle)
        let reading = try #require(table.reading())

        // In a lane tall enough to hold this session a mark a ROW, which the cap is a claim about.
        // A real 459-row session is far past what a deck-sized lane can hold at that granularity,
        // and since #1173 one there is drawn a mark a Turn instead — `MinimapRectTests` is what
        // states the cap at THAT granularity. The height is derived rather than chosen: it is
        // exactly the compression the row grain asks for, plus the point that keeps the division
        // off its own boundary.
        let asked = MinimapGeometry(reading, lane: Self.lane)
        let geometry = MinimapGeometry(reading, lane: CGSize(
            width: Self.lane.width, height: asked.scrollableHeight * asked.rowGrain + 1,
        ))
        #expect(geometry.granularity == .rows)

        // The whole miniature, so every row of the fixture is walked — the lane itself only ever
        // builds the band in front of the reader.
        let drawn = geometry.rects(in: 0 ... geometry.miniatureHeight)
        #expect(!drawn.isEmpty)

        // The slack is the row height's own rounding: the table ceils every height to a whole
        // point, so a run of lines can end a fraction past what it was measured at.
        for rect in drawn {
            let row = geometry.row(
                startingAtOrBefore: rect.y / geometry.scale - geometry.reading.topInset,
            )
            #expect(rect.y + rect.height <= geometry.rectY(row: row + 1) + 1)
        }

        // And the longest row in the document — the one a ceiling would cut — is drawn to its own
        // foot rather than stopping part of the way down it.
        let tallest = try #require(
            geometry.reading.rows.indices.max(by: {
                geometry.reading.rows[$0].height < geometry.reading.rows[$1].height
            }),
        )
        let foot = geometry.rectY(row: tallest + 1)
        let head = geometry.rectY(row: tallest) - 1
        let ink = drawn.filter { $0.y >= head && $0.y < foot }
        #expect(!ink.isEmpty)
        // Nine tenths of its span, not all of it: a row's own bottom padding is inside the extent
        // and the lane draws padding as nothing, so the ink stops a little short by construction
        // (97% of it here). A tenth is more than that padding at any width and far less than any
        // ceiling worth the name — the deleted `markMaximumShare` was 15% of the whole LANE, which
        // on a row this long is barely half of it.
        let reach = (ink.map { $0.y + $0.height }.max() ?? 0) - head
        #expect(reach > (foot - head) * 0.9)
    }
}
