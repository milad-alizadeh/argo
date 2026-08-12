@testable import ArgoUI
import Foundation
import Testing

/// A row's shape turned into the runs that draw it (#382).
///
/// Two claims run under all of it. Every span is inside `0 ... 1` and ordered, because a run's
/// bounds are built from counts read off a transcript nothing validated — and a range whose lower
/// bound is above its upper does not misdraw, it traps. And the line COUNT is always the caller's,
/// off the measured height, so no bar is ever drawn for a line the reading does not have.
@Suite("Minimap runs")
struct MinimapRunsTests {
    /// A 720pt column, the reading measure the feed stops widening at.
    private static let measure: CGFloat = 720

    private static func runs(_ shape: MinimapRowShape, lines: Int = 1) -> [MinimapRun] {
        MinimapRuns.runs(of: shape, over: lines, across: measure)
    }

    @Test
    func `a paragraph is one bar per line it was measured at`() {
        let runs = Self.runs(.prose(length: 1000, ink: .message), lines: 5)
        #expect(runs.map(\.line) == [0, 1, 2, 3, 4])
        #expect(runs.allSatisfy { $0.ink == .message })
    }

    /// The ragged last line is the whole of what makes a block of bars read as prose.
    @Test
    func `the last line of a paragraph is only as full as the words left for it`() {
        let runs = Self.runs(.prose(length: 11, ink: .message), lines: 3)
        #expect(runs.dropLast().allSatisfy { $0.span == 0 ... 1 })
        #expect(runs.last?.span.upperBound == 0.75)
    }

    @Test
    func `prose keeps the leading edge the feed draws it on`() {
        #expect(Self.runs(.prose(length: 40, ink: .thought), lines: 2)
            .allSatisfy { $0.span.lowerBound == 0 })
    }

    /// One bar per line, not one block over the row — a prompt reads as its words, like prose does.
    @Test
    func `a prompt is one bar per line it was measured at`() {
        let runs = Self.runs(.bubble(length: 4000), lines: 3)
        #expect(runs.map(\.line) == [0, 1, 2])
        #expect(runs.allSatisfy { $0.ink == .prompt })
    }

    @Test
    func `a prompt keeps the trailing edge its bubble is drawn on`() {
        let runs = Self.runs(.bubble(length: 12), lines: 1)
        #expect(runs.count == 1)
        #expect(runs[0].span.upperBound == 1)
        #expect(runs[0].span.lowerBound > 0)
    }

    /// The lines anchor where the bubble anchors its text, and the ragged last line runs out short
    /// of the trailing edge.
    @Test
    func `the last line of a prompt is only as full as the words left for it`() {
        let runs = Self.runs(.bubble(length: 4000), lines: 3)
        let leading = 1 - ArgoFeedRow.bubbleShare
        #expect(runs.allSatisfy { abs($0.span.lowerBound - leading) < 0.0001 })
        #expect(runs.dropLast().allSatisfy { $0.span.upperBound == 1 })
        #expect(runs.last.map { $0.span.upperBound < 1 } == true)
    }

    @Test
    func `a mutation says what it did in the feed's own two inks`() {
        let runs = Self.runs(.change(length: 20, added: 30, removed: 10))
        #expect(runs.map(\.ink) == [.command, .added, .removed])
        // Three quarters of the churn was added, so three quarters of the churn's width is. Held to
        // a tolerance because the claim is the proportion, never the last bit of it.
        let share = ArgoMinimapLane.churnShare
        #expect(abs(Self.width(runs[1]) - share * 0.75) < 0.0001)
        #expect(abs(Self.width(runs[2]) - share * 0.25) < 0.0001)
    }

    /// The counts come off a patch in a transcript nothing validated. A negative one used to build
    /// `head ... split` with the two the wrong way round, which trapped the whole app.
    @Test(arguments: [(-5, 10), (10, -5), (-1, -1), (0, 0)])
    func `a patch that counts nonsense still draws an ordered run`(added: Int, removed: Int) {
        let runs = Self.runs(.change(length: 20, added: added, removed: removed))
        #expect(runs.allSatisfy { $0.span.lowerBound <= $0.span.upperBound })
        #expect(runs.allSatisfy { $0.span.lowerBound >= 0 && $0.span.upperBound <= 1 })
    }

    @Test
    func `a column not yet laid out still draws an ordered run`() {
        let runs = MinimapRuns.runs(of: .sentence(length: 40, ink: .command), over: 1, across: 0)
        #expect(runs.allSatisfy { $0.span.lowerBound <= $0.span.upperBound })
    }

    /// Floored rather than rounded, so the bars a row makes always fit inside the space the table
    /// measured for it. What is left over is the gap to the row below — which is why the gaps in
    /// the lane are the feed's own spacing rather than a number somebody picked.
    @Test(arguments: [(0.0, 1), (19.0, 1), (20.0, 1), (39.0, 1), (40.0, 2), (100.0, 5)])
    func `a row is drawn at the whole lines its height holds`(height: CGFloat, lines: Int) {
        #expect(MinimapRuns.lines(inside: height) == lines)
    }

    /// One frame per shot, wrapping where the row's own grid wraps. The count is the whole question
    /// a reader has about a turn that rendered something, so a run of six may not read as one slab.
    @Test
    func `a gallery draws one frame per shot, wrapped as the row wraps them`() {
        // 400pt of column takes two 168pt shots to a line, whatever the contract's gap is.
        let runs = MinimapRuns.runs(of: .shots(count: 5), over: 40, across: 400)

        #expect(runs.count == 5)
        #expect(runs.allSatisfy { $0.ink == .media })
        #expect(runs[1].line == runs[0].line)
        #expect(runs[1].span.lowerBound > runs[0].span.upperBound)
        #expect(runs[2].line > runs[1].line)
        // Each stands as many lines as its own height covers, and none runs the lane's full width.
        #expect(runs.allSatisfy { $0.lines > 1 })
        #expect(runs.allSatisfy { Self.width($0) < 1 })
    }

    @Test
    func `a gallery of nothing draws nothing`() {
        #expect(MinimapRuns.runs(of: .shots(count: 0), over: 4, across: 720).isEmpty)
    }
}

private extension MinimapRunsTests {
    static func width(_ run: MinimapRun) -> CGFloat {
        run.span.upperBound - run.span.lowerBound
    }
}
