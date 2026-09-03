import AppKit
@testable import ArgoUI
import Testing

/// What the landing's converge walk COSTS, which is the claim its own comment makes and could not
/// otherwise back (#1132, ADR-0028 Rule 3).
///
/// `FeedTableCoordinator.converge` asks `rect(ofRow:)` for every row of the reading, because that
/// is the only thing that brings AppKit's own row geometry up to the document the pass settled —
/// left alone the table stands a fifth short of its own heights and the reader can scroll below
/// everything the overview lane maps. It is O(rows) on the main actor, on a path every landing
/// takes, so the size of it is a fact a gate has to hold rather than a sentence in a comment.
///
/// A RATIO and not a second: the machine is a variable, and least-of-N over paired trials is the
/// only shape that survives a loaded box (`CostMeasure`). Linear work over four times the rows may
/// cost about four times as much; the bound is what says it has not quietly become quadratic.
@Suite("Feed converge cost", .serialized)
@MainActor
struct FeedConvergeCostTests {
    private static let pane = CGSize(width: 620, height: 500)

    /// Four times apart, which is enough for a quadratic walk to show up as sixteen.
    private static let few = 300
    private static let many = 1200

    /// The recorded bound and the reasoning behind it live with every other figure this package
    /// gates on (ADR-0028 Rule 7).
    private static let ceiling = PerfBudgets.convergeWalkRatio

    private static func reading(_ count: Int) -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
        }
    }

    /// The walk itself, warm, over both lengths.
    private static func walked(_ rows: [FeedRow]) async throws -> Double {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(rows, in: Self.pane, through: handle)
        await FeedTableFixture.settled(coordinator)
        let table = try #require(coordinator.table)
        return leastCPUSeconds {
            for index in 0 ..< table.numberOfRows {
                _ = table.rect(ofRow: index)
            }
        }
    }

    @Test
    func `the converge walk stays proportional to the reading`() async throws {
        let small = try await Self.walked(Self.reading(Self.few))
        let large = try await Self.walked(Self.reading(Self.many))

        #expect(small > 0, "the walk must be measurable at all")
        let ratio = large / small
        #expect(
            ratio <= Self.ceiling,
            "converge over \(Self.many) rows cost \(ratio)x the walk over \(Self.few)",
        )
    }
}
