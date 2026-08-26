@testable import ArgoUI
import Foundation
import Testing

/// Where a row's reported marks land in the miniature — the half of the arithmetic that decides
/// what is drawn, as against `MinimapGeometryTests`, which is where the reading sits.
///
/// The lane has one job here and the suite holds it to it: scale what the row reported. The numbers
/// divide in binary so no expectation is a rounding story — a 100pt lane beside an 800pt column
/// compresses exactly eight to one.
@MainActor
@Suite("Minimap marks")
struct MinimapMarkTests {
    private static func geometry(_ reading: MinimapReading) -> MinimapGeometry {
        MinimapGeometry(reading, lane: CGSize(width: 100, height: 600))
    }

    private static func reading(_ rows: [MinimapRow], column: CGFloat = 800) -> MinimapReading {
        MinimapReading(rows: rows, columnWidth: column, viewportHeight: 600)
    }

    @Test
    func `each row's mark sits at its own place in the reading`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows([800, 2400, 400]),
            columnWidth: 800,
            viewportHeight: 200,
            topInset: 24,
        )
        let lane = Self.geometry(reading)
        #expect(lane.documentY(row: 0) == 0)
        #expect(lane.documentY(row: 1) == 800)
        #expect(lane.documentY(row: 2) == 3200)
        // The top gutter is scrollable too, so the first mark starts below it.
        #expect(lane.marks(in: 0 ... 600).map(\.y) == [3, 103, 403])
    }

    /// A row reports what its words would make, and the feed may have drawn fewer: a prompt the
    /// reader has folded is measured at two lines however long the prompt is. The marks past what
    /// the row was measured at are dropped, so a fold cannot spill a prompt over the row under it.
    @Test
    func `a row that reports more than the feed drew is held inside its own extent`() {
        let folded = ArgoFeedRow.lineHeight * 2 + ArgoFeedRow.bubbleInsetY * 2
        let whole = MinimapRowShape.bubble(
            MinimapText.paragraph,
            shots: 0,
            isFolded: true,
            across: 800 - ArgoFeedRow.inset * 2,
        )
        let lane = Self.geometry(Self.reading([
            MinimapRow(
                height: folded,
                shape: .bubble(text: MinimapText.paragraph, shots: 0, isFolded: true),
            ),
            MinimapRow(height: 400, shape: .oneLine),
        ]))
        let drawn = lane.marks(in: 0 ... 600).filter { $0.ink == .prompt }
        #expect(whole.count > 2)
        #expect(drawn.count == 2)
        // The last of them ends at the row's own foot, the floor under a mark aside.
        let foot = lane.markY(row: 1) + ArgoMinimapLane.markMinimumHeight
        #expect(drawn.allSatisfy { $0.y + $0.height <= foot })
    }

    /// A paragraph's lines are laid inside the block the row was given. Any of them landing outside
    /// it would put a line of one row's prose over the row above or below it.
    @Test
    func `a row's lines are laid inside the row's own extent`() {
        let lane = Self.geometry(Self.reading([
            MinimapRow(height: 800, shape: MinimapProseBlock.shape(
                of: MinimapText.paragraph, ink: .message,
            )),
        ]))
        let marks = lane.marks(in: 0 ... 600)
        #expect(!marks.isEmpty)
        #expect(marks.allSatisfy { $0.y >= 0 && $0.y + $0.height <= 800 * lane.scale })
    }

    @Test
    func `a row compressed below what can be seen is still drawn at the floor`() {
        let lane = Self.geometry(Self.reading(MinimapGeometryTests.rows([4])))
        #expect(lane.marks(in: 0 ... 600).map(\.height) == [ArgoMinimapLane.markMinimumHeight])
    }

    /// The whole reason #658 exists. At `feedAtScale`'s length the lane squeezed the whole session
    /// into its own height and every mark fell to the floor. At the feed's own ratio a modest row
    /// is several points tall, whatever the length.
    @Test
    func `a session at a real length still has marks that can be told apart`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows(Array(repeating: 40, count: 1031)),
            columnWidth: 620,
            viewportHeight: 600,
        )
        let lane = MinimapGeometry(reading, lane: CGSize(width: 112, height: 600))
        let head = lane.marks(in: 0 ... 600).map(\.height)
        #expect(!head.isEmpty)
        #expect(head.allSatisfy { $0 > ArgoMinimapLane.markMinimumHeight })
    }

    /// Two rows of one line each read as the same weight, whatever spacing the feed put around
    /// them: the padding buys the gap to the next row, exactly as it does in the reading.
    @Test
    func `two one-line rows are drawn the same height however they are spaced`() {
        let lane = Self.geometry(Self.reading([
            MinimapRow(height: 24, shape: .oneLine),
            MinimapRow(height: 39, shape: .oneLine),
        ]))
        let heights = lane.marks(in: 0 ... 600).map(\.height)
        #expect(heights.count == 2)
        #expect(heights[0] == heights[1])
    }

    /// A row compressed until its lines cannot be resolved draws fewer of them rather than a stack
    /// of overdrawn ink — and its head stays exactly where the reading put it.
    @Test
    func `a compressed paragraph drops the lines that would land on each other`() {
        let text = MinimapProseBlock.shape(of: MinimapText.paragraph, ink: .message)
        let tall = Self.geometry(Self.reading([MinimapRow(height: 800, shape: text)]))
        let squeezed = MinimapGeometry(
            Self.reading([MinimapRow(height: 800, shape: text)], column: 8000),
            lane: CGSize(width: 100, height: 600),
        )
        #expect(squeezed.marks(in: 0 ... 600).count < tall.marks(in: 0 ... 600).count)
        #expect(squeezed.marks(in: 0 ... 600).first?.y == tall.marks(in: 0 ... 600).first?.y)
    }

    /// Marks that share a line sit BESIDE each other rather than under each other, so the floor
    /// that thins a compressed paragraph must leave them alone. It did not: a list drew four
    /// markers and no words, and every link accent in the reading went with them.
    @Test
    func `marks sharing a line are all drawn`() {
        let lane = Self.geometry(Self.reading([
            MinimapRow(height: 200, shape: MinimapProseBlock.shape(
                of: "- one item\n- two, per [ADR-0021](https://a.b)\n- three", ink: .message,
            )),
        ]))
        let marks = lane.marks(in: 0 ... 600)
        let words = marks.filter { $0.ink == .message }
        // Three markers and the three runs of words beside them, plus the one link.
        #expect(words.count == 6)
        #expect(marks.filter { $0.ink == .link }.count == 1)
        // Each item's words start past its own marker, and three distinct lines were drawn.
        #expect(Set(words.map(\.y)).count == 3)
    }

    /// A stroked mark thins under compression exactly as a filled one does. Held to bars alone, a
    /// table's cells and a question's card kept every row of their grid at the floor — which is the
    /// same unreadable smear the rule exists to stop, drawn in outline.
    @Test
    func `a compressed table thins its cells rather than stroking every one at the floor`() {
        let table = MinimapProseBlock.shape(
            of: (0 ..< 20).map { "| a\($0) | b\($0) |" }
                .joined(separator: "\n")
                .replacingOccurrences(of: "| a0 | b0 |", with: "| a0 | b0 |\n|---|---|"),
            ink: .message,
        )
        let tall = Self.geometry(Self.reading([MinimapRow(height: 900, shape: table)]))
        let squeezed = MinimapGeometry(
            Self.reading([MinimapRow(height: 900, shape: table)], column: 8000),
            lane: CGSize(width: 100, height: 600),
        )
        let cells = tall.marks(in: 0 ... 600).filter { $0.shape == .frame }
        let thinned = squeezed.marks(in: 0 ... 600).filter { $0.shape == .frame }
        #expect(!cells.isEmpty)
        #expect(thinned.count < cells.count)
    }

    /// Every span the lane draws is inside `0 ... 1` and ordered. The widths behind them come off a
    /// transcript nothing validated, and a range whose lower bound is above its upper does not
    /// misdraw — it traps.
    @Test
    func `every span is ordered and inside the drawable`() {
        let lane = Self.geometry(Self.reading([
            MinimapRow(height: 400, shape: MinimapProseBlock.shape(
                of: "# Big\n\n- one\n\n| a | b |\n|---|---|\n| 1 | 2 |", ink: .message,
            )),
            MinimapRow(height: 40, shape: .oneLine),
            MinimapRow(height: 200, shape: .shots(count: 4)),
        ]))
        let spans = lane.marks(in: 0 ... 600).map(\.span)
        #expect(!spans.isEmpty)
        #expect(spans.allSatisfy { $0.lowerBound >= 0 && $0.upperBound <= 1 })
    }
}
