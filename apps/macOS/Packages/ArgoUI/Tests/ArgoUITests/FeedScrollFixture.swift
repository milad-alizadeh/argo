@testable import ArgoSpecimens
@testable import ArgoUI
import CoreGraphics

/// A scroll policy driven the way the feed drives it — rows first, then whatever the reader or the
/// pane did. No window, no scroll view, no table: everything the policy answers is a value.
enum FeedScrollFixture {
    static let reading = FeedProjection.previewRows
    /// A pane a third of the reading's height, so an offset of zero is unambiguously detached.
    static let pane: CGFloat = 200
    static let readingHeight: CGFloat = 1000

    /// A policy showing `rows`, as though the reading had just arrived.
    static func showing(_ rows: [FeedRow] = reading, held: FeedRow.ID? = nil) -> FeedScrollPolicy {
        var policy = FeedScrollPolicy(held: held)
        _ = policy.resolve(.rowsChanged(from: [], to: rows))
        return policy
    }

    /// A policy already laid out against a pane, so the next width is a re-wrap rather than the
    /// first real one.
    static func laidOut(_ rows: [FeedRow] = reading, held: FeedRow.ID? = nil) -> FeedScrollPolicy {
        var policy = showing(rows, held: held)
        _ = policy.resolve(.paneChanged(width: 600, height: pane, anchor: nil))
        return policy
    }

    /// The reader dragging the reading away from the end.
    static func scrolledAway(_ policy: inout FeedScrollPolicy) -> FeedScrollDecision {
        policy.resolve(.readerScrolled(offset: 0, pane: pane, reading: readingHeight))
    }

    /// The reader dragging it back to the end.
    static func scrolledToEnd(_ policy: inout FeedScrollPolicy) -> FeedScrollDecision {
        policy.resolve(
            .readerScrolled(offset: readingHeight - pane, pane: pane, reading: readingHeight),
        )
    }

    /// One more row said, so an arriving row can be asked where it lands.
    static func oneMoreRow(after rows: [FeedRow] = reading) -> [FeedRow] {
        rows + [FeedRow(id: rows.count, content: .message("and one more thing"))]
    }
}
