import Foundation

/// Which Turn the lane is naming, for a still (#382).
///
/// A hover is the one state a render cannot reach by itself: nothing in a screenshot holds a
/// pointer over anything, and a state with no render is a state nobody has looked at
/// (`rules/designs.md`). So a preview and a specimen say it out loud instead.
enum MinimapNaming: Equatable {
    /// None. What the lane is whenever no pointer is on it, which is nearly always.
    case nothing
    /// The Turn a share of the way down the lane. A share rather than a point, because a still is
    /// rendered at whatever height its window was given.
    case turn(atShare: CGFloat)
    /// Every Turn on screen — what ⇧⌘ asks for.
    case everyTurn

    /// Where down the lane one Turn is named, if one is.
    var share: CGFloat? {
        guard case let .turn(share) = self else { return nil }
        return share
    }
}
