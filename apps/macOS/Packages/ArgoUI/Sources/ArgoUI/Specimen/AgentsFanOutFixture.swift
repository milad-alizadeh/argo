/// A fan-out wide enough to overflow the rail — the state `AgentsRail` says it exists for, and the
/// only one in which the rail scrolls at all.
///
/// Synthesised rather than read off a feed fixture: the transcript fixtures delegate four
/// subagents, and a rail holding four never leaves its column.
enum AgentsFanOutFixture {
    static let agents: [FeedAgent] = briefs.enumerated().map { position, brief in
        FeedAgent(
            id: position,
            label: brief,
            // The first third are still out. A fan-out mid-flight is what the rail is glanced at
            // to read, so the fixture is not a list of finished work.
            isRunning: position.isMultiple(of: 3),
            spend: nil,
        )
    }

    private static let briefs = [
        "Review the feed",
        "Research: how the study inks an attention row",
        "Verify: the fold breaks at every mark",
        "Sweep: every surface that reads a stop reason",
        "Audit the token contract against the render",
        "Trace the seam drag through global space",
        "Measure the qualifier pass on the long transcript",
        "Read every ADR that mentions the canopy",
        "Check the composer survives a Session switch",
        "Confirm the minimap maps the feed it sits beside",
        "Walk the roster from the archive foot upward",
        "Reconcile the spend the header claims",
        "Find the row that moves under a re-wrap",
        "Prove the lightbox hands the keyboard back",
        "Diff the graphite palette against the study",
        "Count the calls a folded run swallows",
        "Watch the permission expire on its own clock",
        "Re-run the boundaries script over ArgoUI",
        "Ask whether the tab line earns its height",
        "Retire the last of the Electron scaffolding",
    ]
}
