import ArgoEngine
import ArgoUI

/// The plans every preview and specimen of the pill is looked at through. Built as ENGINE entries
/// and read through `PlanReading`'s own initialiser, the same one the projection uses.
package enum PlanFixture {
    /// A plan with a step under way — the state the deck's specimen opens on.
    package static let working = reading(
        ("Read the anatomy study in full", .completed),
        ("Run the plan projection suite red", .completed),
        ("Implement the projection seam", .inProgress),
        ("Wire the pill above the dock", .pending),
        ("Independent review, then PR", .pending),
    )

    /// A plan the agent wrote and has not started: nothing in progress, and the pill must say so
    /// rather than nominate the first pending step.
    package static let unstarted = reading(
        ("Read the anatomy study in full", .pending),
        ("Implement the projection seam", .pending),
        ("Independent review, then PR", .pending),
    )

    /// A plan with every step behind it — the other way to name no current step, and the one where
    /// the ring is full.
    package static let finished = reading(
        ("Read the anatomy study in full", .completed),
        ("Implement the projection seam", .completed),
    )

    /// One step. The counter has to read `Step 1/1` rather than shrink to nothing.
    package static let single = reading(("Wire the pill above the dock", .inProgress))

    /// Steps at sentence length — what the pill's one line and the list's two have to survive.
    package static let wordy = reading(
        (
            "Read the approved anatomy study end to end before touching a view, then note every "
                + "measure it carries",
            .completed,
        ),
        (
            "Expose the plan from the projection separately from the row list, with tests over "
                + "replacement, carry-over and absence",
            .inProgress,
        ),
        ("Render the pill above the dock and reveal the whole list on hover or focus", .pending),
    )

    private static func reading(_ entries: (String, PlanEntryStatus)...) -> PlanReading {
        PlanReading(entries: entries.map { PlanEntry(text: $0.0, status: $0.1) })
    }
}
