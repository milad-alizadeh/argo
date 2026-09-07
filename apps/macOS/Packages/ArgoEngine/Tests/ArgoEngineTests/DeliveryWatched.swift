@testable import ArgoEngine
import Foundation

/// The clock the three `TurnDelivery` suites run their watches on, in one place: each of them
/// asserts something about a watch that has run out, and three copies of the arithmetic is three
/// places the figure can drift from what the watch actually takes.
enum DeliveryWatched {
    /// A tenth of the three seconds a real Turn is given, so a suite can watch a Turn without
    /// waiting out the real patience.
    static let patience = Duration.milliseconds(20)

    /// Long enough that a watch which was going to do anything has done all of it. Only for the
    /// claims that are about something NOT happening — everything else waits on the thing itself
    /// through `settle`, because a wall-clock guess is how a suite under load goes green on a race
    /// it never actually ran.
    ///
    /// Sleeps rather than yields: what is being waited on is a `Task.sleep`, and a yield loop
    /// re-enqueues on the main actor without ever letting the clock run.
    static func pauseLongEnoughForTheWholeWatch() async {
        // One more wait than the watch takes, so the pause outlasts it.
        try? await Task.sleep(for: patience * (TurnDelivery.attempts + 3))
    }
}
