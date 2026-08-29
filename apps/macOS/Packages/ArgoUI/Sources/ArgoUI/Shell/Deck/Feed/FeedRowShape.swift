extension FeedRow.Content {
    /// Which view tree a row builds — the branch `FeedRowView.body` takes, named.
    ///
    /// A hosting view handed a DIFFERENT tree tears its own down and builds the new one whole;
    /// handed
    /// the same tree with fresh values it diffs. Measured against `FeedProjection.longRows`:
    /// walking
    /// consecutive rows through ONE host costs 1.365 ms a row, and through a host per shape 0.494
    /// ms.
    /// That difference is the reading's whole interactive cost — it is paid once per row exposed by
    /// a
    /// scroll, and once per row again by the ruler on every re-measure.
    ///
    /// So this is what the table recycles cells by (`tableView(_:viewFor:row:)`) and what the ruler
    /// keeps a controller per (`FeedTableCoordinator.measuredHeight`). It is a fact about the VIEW,
    /// not about the row: `message` and `thought` share one, because both build `FeedProse` and a
    /// voice is a value it diffs.
    enum Shape: String, CaseIterable, Sendable {
        case prompt
        case prose
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
        case .message, .thought: .prose
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
