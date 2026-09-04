import ArgoUI

// A session past the length the overview lane can draw a mark a row — see `deepRows`. Its own file
// because `FeedProjection+Preview.swift` is at its length ceiling.

extension FeedProjection {
    /// A session long enough that the lane runs out of lane and coarsens to a mark a Turn (#1173).
    ///
    /// Ten times `longRows`, which puts it at about 3,000 rows in 500 Turns — the shape the
    /// coarsening was measured on, and the only shape the coarse lane can be LOOKED at in. Nothing
    /// shorter reaches it in a window-height lane: at 300 rows the whole session still fits a mark
    /// a row, which is what `minimapLane` renders.
    ///
    /// The text is made distinct per row for the reason `MinimapLaneFixture.deepRows` states: two
    /// rows of identical prose share a wrapped store entry, and a lane drawn over those would be a
    /// picture of a cache.
    static let deepRows: [FeedRow] = (0 ..< longRows.count * 10).map { at in
        let row = longRows[at % longRows.count]
        guard case let .message(text) = row.content else {
            return FeedRow(id: at, content: row.content)
        }
        return FeedRow(id: at, content: .message("\(text) [\(at)]"))
    }
}
