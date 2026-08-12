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

    @Test
    func `a prompt keeps the trailing edge its bubble is drawn on`() {
        let runs = Self.runs(.bubble(length: 12), lines: 3)
        #expect(runs.count == 1)
        #expect(runs[0].span.upperBound == 1)
        #expect(runs[0].span.lowerBound > 0)
        // One block over all three lines, not one bar on the first.
        #expect(runs[0].lines == 3)
    }

    @Test
    func `a prompt too long for its bubble stops where the bubble stops`() {
        let runs = Self.runs(.bubble(length: 4000))
        #expect(runs[0].span.lowerBound == 1 - ArgoFeedRow.bubbleShare)
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
}

private extension MinimapRunsTests {
    static func width(_ run: MinimapRun) -> CGFloat {
        run.span.upperBound - run.span.lowerBound
    }
}
