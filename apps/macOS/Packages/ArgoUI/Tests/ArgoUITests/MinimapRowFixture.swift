@testable import ArgoUI

/// One feed row at the lane's own scale, for the two suites that read a shape off it (#382):
/// `MinimapRowTests` and `MinimapAskCardTests`.
@MainActor
enum MinimapRowFixture {
    static func row(_ content: FeedRow.Content) -> MinimapRow {
        MinimapRow(FeedRow(id: 0, content: content), height: 20)
    }

    static func shape(_ content: FeedRow.Content) -> MinimapRowShape {
        row(content).shape
    }
}
