import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import ProseText
import Testing

/// The reading the lane's cost cases and its figure recording both measure over.
///
/// One fixture rather than two: `MinimapCostTests` gates on counts and `MinimapFigureRecording`
/// records the seconds those counts are made of, so a figure recorded over a different reading
/// than the one gated would say nothing about it.
@MainActor
enum MinimapCostFixture {
    static let column = CGSize(width: 620, height: 800)
    static let lane = CGSize(width: 112, height: 800)

    /// The band the lane holds as pixels: its own height, from the head of the miniature.
    static let band: ClosedRange<CGFloat> = 0 ... Self.lane.height

    /// A session of the projection's own rows, every text made distinct — the stores are static and
    /// shared, so a fixture reusing another's strings would be handed a warm cache and measure
    /// nothing. The tag is what keeps each case's cold pass cold.
    static func rows(_ count: Int, tag: String) -> [FeedRow] {
        let base = FeedProjection.longRows
        return (0 ..< count).map { at in
            let row = base[at % base.count]
            guard case let .message(text) = row.content else {
                return FeedRow(id: at, content: row.content)
            }
            return FeedRow(id: at, content: .message("\(text) [\(tag)/\(at)]"))
        }
    }

    /// A table with its settled document already on screen — which is what a laid-out reading
    /// means since ADR-0030: nothing is drawn and nothing can be mapped until the pass lands.
    static func laid(_ rows: [FeedRow]) async -> FeedTableCoordinator {
        ProseReading.holding(rows: rows.count)
        return await FeedTableFixture.laidOut(rows, in: column, through: FeedTableHandle())
    }

    /// A lane over a session, and the geometry it holds still.
    ///
    /// `atWidth` is the column the prose wrapped across, and it is what `ProseMetrics` keys its
    /// wrapped store by. Those stores are static and shared with the two thousand other tests in
    /// this process, so a case counting what came OFF one takes a width of its OWN — at the shared
    /// 620 its entries can be evicted mid-case by whatever measured there before it, which is a
    /// fact about the suite and not about the lane. Caught as a 1-in-19 flake in exactly that case.
    static func geometry(over rows: [FeedRow], atWidth width: CGFloat = column.width)
        async throws -> MinimapGeometry {
        var reading = try #require(await Self.laid(rows).reading())
        reading.columnWidth = width
        return MinimapGeometry(reading, lane: Self.lane)
    }
}
