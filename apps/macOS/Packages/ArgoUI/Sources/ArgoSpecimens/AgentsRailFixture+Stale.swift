import ArgoEngine
import ArgoFixtures
import ArgoUI

extension AgentsRailFixture {
    /// The state #1090 was written from, and the one no fixture held: a Session that IS running,
    /// holding backgrounded delegations from yesterday whose reports never landed.
    ///
    /// #1076's `quiet` render cannot show it — there the Session had gone, which is what quieted
    /// the dots. Here the Session is at work, so every earlier reading of these rows said
    /// `4 running`, with green dots and clocks at `33h 07m`, `31h 12m` and `30h 41m` on three of
    /// them. What settles it in pixels is `1 running`, one chip, and a disclosure standing for the
    /// three whose reports were lost.
    ///
    /// The one live handover among them is what keeps the render honest about the fix's shape: the
    /// ceiling takes the stale chips away and leaves the working one exactly where it was.
    static let staleRows = FeedProjection.rows(from: stale, working: true)

    private static let stale: [TranscriptEvent] = [
        .prompt(
            text: "Take the four open bug tickets, one agent each.",
            images: [],
            atMs: 1_733_000_000_000,
        ),
        .message(markdown: "Four agents out, one per ticket, each in a worktree of its own."),
    ]
        + delegation("Implement #1027", hours: 33)
        + delegation("Implement #1026", hours: 31)
        + delegation("Implement #1015", hours: 30)
        + delegation("Rebase #1049 onto main", hours: 0)

    /// One backgrounded delegation as the record leaves it: the handover, and the receipt that
    /// resolves nothing (#908). Every one names the same Subagent reading, so a chip the disclosure
    /// opens onto is a control rather than a quiet row.
    private static func delegation(_ brief: String, hours: Int) -> [TranscriptEvent] {
        let id = "stale-\(hours)"
        return [
            .toolCall(ToolCall(
                id: id,
                name: "Agent",
                kind: .delegate,
                target: brief,
                narration: brief,
                atMs: TranscriptFixtures.handedOver(hours * 60 * 60 + 400),
            )),
            .toolCallOutcome(TranscriptFixtures.launched(
                id,
                subagent: TranscriptFixtures.verifierID,
            )),
        ]
    }
}
