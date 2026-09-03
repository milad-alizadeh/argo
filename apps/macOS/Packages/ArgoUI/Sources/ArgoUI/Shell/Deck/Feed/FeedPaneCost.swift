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

/// What bringing AppKit's own row geometry up to the settled document costs (#1132, ADR-0028
/// Rules 7 and 8).
///
/// Its own reading rather than a fifth field on `FeedPaneCost`: that one is what ONE clip-view
/// notification costs, and this is what a landing and an adopt cost — different paths, different
/// occasions, and four is the cap on a list a memberwise init takes (#755, edge 6).
struct FeedConvergeCost {
    /// How many row heights AppKit has asked the coordinator for.
    ///
    /// What `FeedConvergeCostTests` gates on, and a count rather than a duration because that is
    /// what the regression IS: the converge walk resolves the table's own row geometry by asking
    /// after every row, so a landing that walked twice, or an adopt that walked a third time, shows
    /// up here exactly and shows up in a stopwatch only as noise.
    var heightAsks = 0
}
