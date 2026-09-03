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
/// The counted thing is the WALK, in `FeedConvergeCost` — how many times it ran and over how many
/// rows. NOT the delegate's height asks, which was the first instrument here and was blind: `show`
/// notes every row before the walk reaches it and `noteHeightOfRows` asks eagerly, so the walk
/// itself asks the delegate for nothing and this whole suite stayed green with both `converge`
/// calls deleted. That the rows end up as tall as their document is
/// `MinimapScrollableHeightTests`; this is only how much walking that took.
@Suite("Feed converge cost", .serialized)
@MainActor
struct FeedConvergeCostTests {
    private static let pane = CGSize(width: 620, height: 500)

    private static let few = 200

    private static func reading(_ count: Int) -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
        }
    }

    /// A mount and its first landing: ONE walk, over the rows there are.
    ///
    /// Exactly one, because a second is the regression — a landing that converged inside a loop, an
    /// `adoptSettled` running a walk after a landing's, a walk left in a notification handler. Each
    /// of those is an integer here and noise in a stopwatch.
    @Test
    func `a mount and its landing walk the rows once`() async {
        let coordinator = await FeedTableFixture
            .laidOut(Self.reading(Self.few), in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(coordinator)

        #expect(coordinator.convergeCost.walks == PerfBudgets.convergeWalksPerLanding)
        #expect(coordinator.convergeCost.walkedRows == Self.few)
    }

    /// And the same of the ADOPT path, which is the one no pass ever lands on (#858).
    ///
    /// Its own case because the landing's does not reach it: `laidOut` measures, so a walk added to
    /// or removed from `adoptSettled` moves nothing above. A deck the reader has opened before
    /// takes this route on every re-click, and it is where the walk was missing entirely.
    @Test
    func `a kept document adopted walks the rows once`() async {
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
        #expect(adopting.convergeCost.walks == PerfBudgets.convergeWalksPerLanding)
        #expect(adopting.convergeCost.walkedRows == Self.few)
    }

    /// A reading that GROWS lands again, and pays one more walk over the rows there now are.
    ///
    /// The whole document each time, and that is deliberate: `show` reloads, and a reload drops
    /// AppKit's row-rect cache wholesale, so a walk scoped to the appended rows leaves everything
    /// above them at the placeholder height — 8 819pt short on a twelve-row append, measured. What
    /// this gates is that the walk is paid once a LANDING and not once a row.
    @Test
    func `a reading that grew walks the grown rows once more, and no more`() async {
        let rows = Self.reading(Self.few)
        let coordinator = await FeedTableFixture
            .laidOut(rows, in: Self.pane, through: FeedTableHandle())
        await FeedTableFixture.settled(coordinator)
        let landed = coordinator.convergeCost

        let grown = Self.reading(Self.few + 12)
        coordinator.apply(FeedTableFixture.model(showing: grown))
        await FeedTableFixture.settled(coordinator)

        #expect(coordinator.convergeCost.walks - landed.walks
            == PerfBudgets.convergeWalksPerLanding)
        #expect(coordinator.convergeCost.walkedRows - landed.walkedRows == grown.count)
    }
}
