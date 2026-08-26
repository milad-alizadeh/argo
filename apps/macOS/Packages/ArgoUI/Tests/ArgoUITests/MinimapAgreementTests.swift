import AppKit
@testable import ArgoUI
import Testing

/// The claim the whole reporting rework exists to make: what a row REPORTS it drew agrees with what
/// the feed table MEASURED it at, and what the lane DRAWS never leaves the row it belongs to.
///
/// A blind check on both counts. The reading is laid out by the real coordinator, the heights are
/// its own, and neither side is a fixture the other could have been written to agree with.
@MainActor
@Suite("Minimap agreement with the feed")
struct MinimapAgreementTests {
    private static let column = CGSize(width: 620, height: 480)

    private static func lane(over rows: [FeedRow]) -> MinimapGeometry? {
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(rows, in: column, through: handle)
        guard let reading = table.reading() else { return nil }
        return MinimapGeometry(reading, lane: CGSize(width: 112, height: column.height))
    }

    /// Every row, as the content height the table gave it beside the extent it reported.
    private static func compared(_ rows: [FeedRow]) -> [(measured: CGFloat, reported: CGFloat)] {
        guard let lane = lane(over: rows) else { return [] }
        return lane.reading.rows.map { row in
            // The step above a row is drawn INSIDE its cell, so the content gets what is left.
            let content = row.height - row.topStep
            let reported = row.shape
                .rects(across: lane.proseMeasure, height: content)
                .map { $0.y + $0.height }
                .max() ?? 0
            return (content, reported)
        }
    }

    /// One line of slack either way.
    ///
    /// Short is ordinary and often right: a bubble's bottom padding, a prompt's fold control and
    /// the breath around a gallery are the row's spacing rather than its content, and the lane
    /// draws none of them. Over is bounded at one line because Core Text and TextKit break a long
    /// paragraph the same way to within a line — and `everything the lane draws stays inside its
    /// row` is what makes that safe rather than something to chase.
    private static func agrees(_ pair: (measured: CGFloat, reported: CGFloat)) -> Bool {
        pair.reported <= pair.measured + ProseFace.body.step
    }

    @Test
    func `every row of the preview reading reports what the table measured it at`() {
        let compared = Self.compared(FeedProjection.previewRows)
        #expect(!compared.isEmpty)
        #expect(compared.allSatisfy { Self.agrees($0) })
    }

    /// The markdown reading is the one the complaints came from: a pipe table, a fence, a heading,
    /// a list and a prompt in one feed.
    @Test
    func `every row of the markdown reading reports what the table measured it at`() {
        let compared = Self.compared(FeedProjection.previewMarkdownRows)
        #expect(!compared.isEmpty)
        #expect(compared.allSatisfy { Self.agrees($0) })
    }

    /// The guarantee. Whatever a row reports, the lane holds it inside the row's own scaled band —
    /// so a rect can never stand over the row below the one it belongs to.
    @Test
    func `everything the lane draws stays inside the row it belongs to`() {
        for rows in [FeedProjection.previewRows, FeedProjection.previewMarkdownRows] {
            guard let lane = Self.lane(over: rows) else {
                Issue.record("the fixture laid out no reading")
                continue
            }
            let bands = lane.reading.rows.indices.map { at in
                lane.rectY(row: at) ... lane.rectY(row: at) + lane.reading.rows[at].height
                    * lane.scale + ArgoMinimapLane.rectMinimumHeight
            }
            for rect in lane.rects(in: 0 ... lane.miniatureHeight) {
                #expect(bands.contains { $0.contains(rect.y) && $0.contains(rect.y + rect.height) })
            }
        }
    }

    /// The table specifically. Its cells are dealt by `MarkdownTable`, which is also what the
    /// feed's own layout places them with — so the grid in the lane is the same fraction of the
    /// same table.
    @Test
    func `a pipe table's cells fill the measure and the height the row was measured at`() {
        let table = MarkdownTable(
            header: ["Rule", "Where it is spelled"],
            rows: [["A column is as wide as its widest cell wants", "`FeedMarkdownTable`"]],
        )
        let measure: CGFloat = 620 - ArgoFeedRow.inset * 2
        let laid = table.laid(across: measure)
        #expect(laid.rects.count == 4)
        #expect(abs((laid.rects.map(\.to).max() ?? 0) - measure) < 0.0001)
        #expect(laid.height == table.heights(on: table.widths(across: measure)).reduce(0, +))
    }
}
