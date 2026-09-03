import AppKit
@testable import ArgoUI
import Testing

/// What the landing's converge walk COSTS, said as the count it is (#1132, ADR-0028 Rules 3 and 8).
///
/// `FeedTableCoordinator.converge` asks `rect(ofRow:)` for every row, because that is the only
/// thing that brings AppKit's own row geometry up to the document the pass settled — left alone
/// the table stands a fifth short of its own heights and the reader scrolls below everything the
/// overview lane maps. It is O(rows) on the main actor, on a path every landing and every adopt
/// takes, so its size is gated rather than described.
///
/// A COUNT and not a stopwatch, and the counted thing is `heightAsks` — what AppKit actually asks
/// the coordinator for. That is the real code rather than a copy of the loop, it is measured cold
/// on a path that is only ever cold, and the regression worth catching is a count: a landing that
/// walks twice, or an adopt that walks a third time. A duration would read those as noise.
@Suite("Feed converge cost", .serialized)
@MainActor
struct FeedConvergeCostTests {
    private static let pane = CGSize(width: 620, height: 500)

    /// Two lengths, four times apart, so a walk that had become quadratic reads sixteen rather than
    /// four against the shorter one.
    private static let few = 200
    private static let many = 800

    private static func reading(_ count: Int) -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
        }
    }

    /// Every height AppKit asked for over one mount and its first landing.
    private static func asked(over count: Int) async -> Int {
        let coordinator = await FeedTableFixture
            .laidOut(Self.reading(count), in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(coordinator)
        return coordinator.convergeCost.heightAsks
    }

    /// The shape: the asks follow the reading, and are not a multiple of it that grows with it.
    @Test
    func `the converge walk follows the reading and not the square of it`() async {
        let small = await Self.asked(over: Self.few)
        let large = await Self.asked(over: Self.many)

        #expect(small > 0, "AppKit must have asked for heights at all")
        let ratio = Double(large) / Double(small)
        #expect(
            ratio <= PerfBudgets.convergeWalkRatio,
            "\(Self.many) rows asked \(large) heights against \(small) for \(Self.few) — \(ratio)x",
        )
    }

    /// And EXACTLY one ask a row over a mount and its landing — no height is taken twice.
    ///
    /// Gated exactly rather than with slack because the number is exact: `rect(ofRow:)` resolves a
    /// row once and answers from AppKit's own cache after, so a second walk cannot reach the
    /// delegate again unless something invalidated the cache in between. A landing that converged
    /// inside a loop, an `adoptSettled` running a second walk after a landing's, or a reload
    /// slipped between the two, all read as more than one and none of them read as a duration.
    @Test
    func `a mount and its landing ask for each height exactly once`() async {
        let asks = await Self.asked(over: Self.few)

        #expect(asks == Self.few * PerfBudgets.convergeAsksPerRow)
    }

    /// And the same of the ADOPT path, which is the one no pass ever lands on (#858).
    ///
    /// Its own case because the landing's does not reach it: `laidOut` measures, so a walk added to
    /// or removed from `adoptSettled` moves nothing above. A deck the reader has opened before
    /// takes
    /// this route on every re-click, and it is where the converge walk was missing entirely.
    @Test
    func `a kept document adopted asks for each height exactly once`() async {
        let rows = Self.reading(Self.few)
        let settled = await FeedTableFixture
            .laidOut(rows, in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(settled)

        let adopting = FeedTableFixture.mounting(
            rows,
            in: Self.pane,
            keeping: FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: settled.geometry),
        )

        #expect(adopting.measurements == 0, "the adopt branch must be the one taken")
        #expect(adopting.convergeCost.heightAsks == Self.few * PerfBudgets.convergeAsksPerRow)
    }
}
