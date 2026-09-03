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

    /// D25's weight cap, as ADR-0030 leaves it: a row that draws less than it holds keeps the
    /// WHOLE vertical span the settled document gave it, and the cap is on what is drawn inside.
    ///
    /// A folded prompt is the case with a cap anybody can name — six lines of however many were
    /// typed (`ArgoFeedRow.collapsedPromptLines`). The lane reports the six, and the row after it
    /// still starts one settled height below rather than under the marks.
    @Test
    func `a row drawing less than it holds keeps its whole span and caps the mark inside it`(
    ) async throws {
        let long = String(
            repeating: "A prompt long enough to fold, and then rather more of it. ", count: 12,
        )
        let rows = [
            FeedRow(id: 0, content: .prompt(text: long, shots: [])),
            FeedRow(id: 1, content: .message("The answer.")),
        ]
        let handle = FeedTableHandle()
        let table = await FeedTableFixture.laidOut(rows, in: Self.pane, through: handle)
        let document = try #require(table.geometry.settled)
        let geometry = try MinimapGeometry(#require(table.reading()), lane: Self.lane)
        let height = try #require(document.height(at: 0))
        let measure = geometry.proseMeasure

        // The span: the row after it starts exactly one settled height below, whatever was drawn.
        #expect(geometry.documentY(row: 1) - geometry.documentY(row: 0) == height)

        // The cap: the prompt holds more lines than the fold lets it draw, and the folded shape is
        // held to them.
        let held = MinimapRowShape.bubble(text: long, shots: [], isFolded: false)
            .rects(across: measure, height: height)
        let drawn = MinimapRowShape.bubble(text: long, shots: [], isFolded: true)
            .rects(across: measure, height: height)
        #expect(held.count > ArgoFeedRow.collapsedPromptLines)
        #expect(drawn.count == ArgoFeedRow.collapsedPromptLines)

        // And what the LANE puts on screen for the row stays inside the row's own span.
        let foot = geometry.rectY(row: 1)
        let inside = geometry.rects(in: 0 ... foot).filter { $0.y < foot }
        #expect(!inside.isEmpty)
        #expect(inside.allSatisfy { $0.y + $0.height <= foot + 1 })
    }
}
