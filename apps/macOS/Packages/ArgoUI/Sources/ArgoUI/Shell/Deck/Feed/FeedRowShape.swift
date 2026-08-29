extension FeedRow.Content {
    /// Which view tree a row builds — the branch `FeedRowView.body` takes, named.
    ///
    /// A hosting view handed a DIFFERENT tree tears its own down and builds the new one whole;
    /// handed the same tree with fresh values it diffs. Over `FeedProjection.longRows`, walking
    /// consecutive rows through ONE host costs 1.365 ms a row and through a host per shape
    /// 0.494 ms. That difference is paid once per row a scroll exposes, and once per row again by
    /// the ruler on every re-measure.
    ///
    /// So this is what the table recycles cells by (`tableView(_:viewFor:row:)`) and what the
    /// ruler keeps a controller per (`FeedTableCoordinator.measuredHeight`). It is a fact about
    /// the VIEW rather than about the row, and it is one shape per BRANCH: `message` and `thought`
    /// build the same `FeedProse`, but they are two arms of that switch, so SwiftUI gives them
    /// separate structural identity and rebuilds across them anyway. Folding them cost 13% of the
    /// measure pass and bought nothing.
    enum Shape: String, Sendable {
        case prompt
        case message
        case thought
        case call
        case survey
        case gallery
        case skillLoaded
        case ask
        case mark
        case unreadable
    }

    /// No `default`, for `kind`'s reason: an eleventh case fails this build rather than quietly
    /// recycling into a tree that draws something else.
    var shape: Shape {
        switch self {
        case .prompt: .prompt
        case .message: .message
        case .thought: .thought
        case .call: .call
        case .survey: .survey
        case .gallery: .gallery
        case .skillLoaded: .skillLoaded
        case .ask: .ask
        case .mark: .mark
        case .unreadable: .unreadable
        }
    }
}
