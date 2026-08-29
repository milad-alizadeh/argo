import Foundation

/// What the feed's clip-view frame notification costs, counted rather than inferred (ADR-0028
/// Rule 7).
///
/// DEBUG-only, unlike `FeedTableCoordinator.measurements` and `MinimapLaneView.rectRedraws` beside
/// it: those two predate ADR-0028, and Rule 7 asks for a derivation counter that a release build
/// does not carry. Nothing outside a suite reads these.
struct FeedPaneCost {
    /// Every notification the handler received.
    var notices = 0
    /// Those that reached the policy.
    var derivations = 0
    /// Notices that arrived while a derivation was on the stack. This is the loop #955 names —
    /// landing the reading forces a layout, and that layout re-fires the notification that forced
    /// it. Mounting the feed in a real window records one.
    var reentrances = 0
    /// Derivations that ran inside another. Zero is the claim, and the handler's re-entry guard is
    /// what holds it.
    var nestings = 0
}
