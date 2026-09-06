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
    /// How many times the walk has run, and how many rows it walked over all of them.
    ///
    /// The WALK and not the heights it asks for. `show` notes every row before the walk reaches it
    /// and `noteHeightOfRows` asks eagerly, so by the time `converge` runs, AppKit has the heights
    /// and the walk itself asks the delegate for nothing at all — a counter on the delegate's
    /// height accessor stays green with both `converge` calls deleted, which is a gate that cannot
    /// see its own subject. What the walk costs is the rows it visits, so that is what is counted.
    ///
    /// A count rather than a duration because that is what the regression IS: a landing that walked
    /// twice, an adopt that walked a third time, a walk moved inside a loop. Each of those is an
    /// integer here and noise in a stopwatch.
    var walks = 0
    var walkedRows = 0
}
