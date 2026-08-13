import ArgoEngine
import Foundation

/// A fan-out wide enough to overflow the rail — the state `AgentsRail` says it exists for, and the
/// only one in which the rail scrolls at all.
///
/// Synthesised rather than read off a feed fixture: the transcript fixtures delegate four
/// subagents, and a rail holding four never leaves its column.
enum AgentsFanOutFixture {
    static let agents: [FeedAgent] = briefs.enumerated().map { position, brief in
        // The first third are still out. A fan-out mid-flight is what the rail is glanced at
        // to read, so the fixture is not a list of finished work.
        let isRunning = position.isMultiple(of: 3)
        return FeedAgent(
            id: position,
            label: brief,
            isRunning: isRunning,
            // The three figures arrive TOGETHER, on the record that answers the handover — so a
            // running chip has none of them and counts up from `startedAtMs` instead. Varied per
            // position, because a column of twenty identical figures proves nothing about the
            // column's rhythm.
            spend: isRunning ? nil : spent(at: position),
            subagentID: isRunning ? nil : "a-\(position)",
            durationMs: isRunning ? nil : 40000 + position * 23000,
            startedAtMs: isRunning ? Date().epochMs - (30 + position) * 1000 : nil,
        )
    }

    private static func spent(at position: Int) -> Usage {
        Usage(
            inputTokens: 1200 + position * 140,
            outputTokens: 3400 + position * 900,
            cacheReadTokens: 90000 + position * 4300,
            cacheCreationTokens: 0,
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
