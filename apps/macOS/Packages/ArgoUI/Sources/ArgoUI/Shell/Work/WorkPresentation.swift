/// How one parent ticket is PRESENTED — as the ordinary node tree, or as the Route (#334, #335).
///
/// Map-SCOPED and not room-scoped: it switches the ticket being looked at, so switching one parent
/// to a map leaves the room's rail alone and leaves every other ticket on whatever it had. Which
/// parents a reader has switched is therefore a set of ticket numbers rather than one value — the
/// same shape, and for the same reason, as the folded parents the tree holds.
enum WorkPresentation: String, Sendable, CaseIterable, Identifiable {
    /// The node tree, scoped to this parent.
    case tree
    /// The Route — the parent's children on one progress axis.
    case map

    var id: Self {
        self
    }

    /// WRITTEN, like a view's name and unlike anything a tracker serves: these two words name what
    /// Argo does with the tickets, and no provider has an opinion about them.
    var name: String {
        switch self {
        case .tree: "Tree"
        case .map: "Map"
        }
    }
}
