@testable import ArgoUI
import Foundation
import Testing

/// The lane drawn at the widths the reading really wrapped to, rather than at a character count
/// divided (#382 as amended). The wrap is handed in as a value — see `MinimapWrapping` — so what is
/// asserted here is that the lane draws exactly what it was told the reading looks like.
@Suite("Minimap measured lines")
struct MinimapMeasuredTests {
    private static let measure: CGFloat = 720

    @Test
    func `a paragraph's bars are the widths its lines came out at`() {
        let wrap = MinimapWrapping(blocks: [[1, 1, 0.42]])
        let runs = MinimapRuns.runs(
            of: .prose(text: MinimapText.words(300), ink: .message),
            over: 3,
            across: Self.measure,
            wrapped: wrap,
        )
        #expect(runs.map(\.span.upperBound) == [1, 1, 0.42])
    }

    /// A one-word paragraph is a short bar. Dividing its character count gave it a FULL one:
    /// the last line is the only ragged one, and a single line is the last line.
    @Test
    func `a one-line paragraph is as wide as its one line`() {
        let runs = MinimapRuns.runs(
            of: .prose(text: "Done.", ink: .message),
            over: 1,
            across: Self.measure,
            wrapped: MinimapWrapping(blocks: [[0.08]]),
        )
        #expect(runs.map(\.span.upperBound) == [0.08])
    }

    /// A row the lane compressed shows the paragraph it is, evenly sampled — not its first lines
    /// with the rest of it dropped.
    @Test
    func `a compressed paragraph is sampled across its own lines`() {
        let fills = MinimapRuns.sampled([1, 1, 1, 1, 0.3], over: 2)
        #expect(fills == [1, 1])
        #expect(MinimapRuns.sampled([1, 0.3], over: 4).last == 0.3)
    }

    @Test
    func `an unmeasured row still divides its characters`() {
        let runs = MinimapRuns.runs(
            of: .prose(text: MinimapText.words(11), ink: .message), over: 3, across: Self.measure,
        )
        #expect(runs.last?.span.upperBound == 0.75)
    }

    /// A prompt's ground is as wide as its longest line and no wider, which is the bubble the feed
    /// draws — and the lines sit against that ground's leading edge, as its words do.
    @Test
    func `a prompt's bubble is as wide as its longest line`() {
        let inset = ArgoFeedRow.bubbleInsetX / Self.measure
        let runs = MinimapRuns.runs(
            of: .bubble(text: MinimapText.words(40)),
            over: 2,
            across: Self.measure,
            wrapped: MinimapWrapping(blocks: [[0.3, 0.1]]),
        )
        #expect(runs.count == 2)
        // The ground runs from its widest line plus a pad at each end, back from the trailing edge.
        #expect(abs(runs[0].span.lowerBound - (1 - 0.3 - inset)) < 0.0001)
        #expect(abs(runs[0].span.upperBound - (1 - inset)) < 0.0001)
        // The short second line starts where the first does and stops short of it.
        #expect(runs[1].span.lowerBound == runs[0].span.lowerBound)
        #expect(runs[1].span.upperBound < runs[0].span.upperBound)
    }

    /// A prompt of one line was drawn as two: the row's measured height carries the bubble's own
    /// padding, and the lane divided the whole of it by the line height.
    @Test @MainActor
    func `a one-line prompt is one line of lane`() {
        let bubble = 20 + ArgoFeedRow.bubbleInsetY * 2
        let reading = MinimapReading(
            rows: [MinimapRow(height: bubble, shape: .bubble(text: "Fix the seam"))],
            columnWidth: 800,
            viewportHeight: 600,
        )
        let lane = MinimapGeometry(reading, lane: CGSize(width: 100, height: 600))
        #expect(lane.drawnLines(row: 0) == 1)
    }

    /// The same padding is spacing rather than content, so it must not be measured as either: a
    /// prompt of three lines is three lines of lane.
    @Test @MainActor
    func `a three-line prompt is three lines of lane`() {
        let bubble = 60 + ArgoFeedRow.bubbleInsetY * 2
        let reading = MinimapReading(
            rows: [MinimapRow(height: bubble, shape: .bubble(text: MinimapText.words(300)))],
            columnWidth: 800,
            viewportHeight: 600,
        )
        let lane = MinimapGeometry(reading, lane: CGSize(width: 100, height: 600))
        #expect(lane.drawnLines(row: 0) == 3)
    }
}
