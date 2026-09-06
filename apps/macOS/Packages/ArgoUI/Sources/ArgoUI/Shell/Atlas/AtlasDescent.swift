import AtlasLayout

/// Where the reader is in the Map, and the one verb that moves them (#1156).
///
/// A trail and its verb, together for `AtlasFocus`'s reason: separately they are two parameters
/// that mean nothing apart — a trail nothing can walk is a label, and a walk with no trail has
/// nowhere to go.
@MainActor
package struct AtlasDescent {
    /// The folders from the Map's root down to where the reader is, root first. Never empty: a
    /// reader who has descended into nothing is still somewhere, and that somewhere is the
    /// repository.
    package let trail: [AtlasStep]

    /// Go to the folder at a path. One verb for the crumbs and for the control back up, because
    /// they are one move to two places rather than two moves.
    package let enter: (String) -> Void

    package init(trail: [AtlasStep], enter: @escaping (String) -> Void) {
        self.trail = trail
        self.enter = enter
    }

    /// The folder one level up, or nothing where the reader is at the top and there is no way back
    /// to draw. Derived from the trail rather than held beside it: a "can go up" that could
    /// disagree with the trail is a button that goes nowhere.
    package var up: String? {
        trail.dropLast().last?.path
    }
}
