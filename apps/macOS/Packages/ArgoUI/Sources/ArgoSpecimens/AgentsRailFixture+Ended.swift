import ArgoEngine
import ArgoFixtures
import ArgoUI

extension AgentsRailFixture {
    /// The state #1392 was reported from: a RUNNING parent holding four backgrounded delegations
    /// whose children have each filed a report and stopped, and whose closing `task-notification`
    /// never landed.
    ///
    /// Neither `stale` nor `waiting` can show it. In `stale` the delegations are a day old, so the
    /// ceiling reaches them; in `waiting` the children are still writing. Here they are 25 minutes
    /// and 2h29m old — inside the four-hour ceiling, past the ten-minute growth window — which is
    /// the whole gap this ticket closes. Every earlier reading of these rows drew four green dots
    /// and four climbing clocks.
    ///
    /// What settles it in pixels is the column being EMPTY over its disclosure: `0 running`, and
    /// four chips filed behind the control at the foot.
    static let endedRows = FeedProjection.rows(from: ended)

    /// Those records read as a RUNNING Session's, with every child's file watched and silent.
    ///
    /// `silent` and not the absence of `writing`: a file Argo never watched grow dates nothing, and
    /// a chip whose ending is read against that would be quieted on absence of evidence
    /// (`SubagentWriting.unwatched`). The claim this fixture makes is the observed one — Argo saw
    /// these files, and they have stopped.
    static let endedReadings = FeedAgentReader(
        events: Dictionary(uniqueKeysWithValues: endedBriefs.map { ($0.child, verifier) }),
        of: .running,
        growth: StatedGrowth(silent: Set(endedBriefs.map(\.child))),
    )

    private static let ended: [TranscriptEvent] = [
        .prompt(
            text: "Review #1343 and #1344 on both axes, one agent each.",
            images: [],
            atMs: 1_733_000_000_000,
        ),
        .message(markdown: "Four agents out, two per pull request. I will wait for all four."),
    ]
        + endedBriefs.flatMap(endedDelegation)

    /// One backgrounded delegation as the record leaves it: the handover, and the receipt that
    /// resolves nothing (#908). No report follows any of them, which is the lost notification.
    private static func endedDelegation(_ brief: EndedBrief) -> [TranscriptEvent] {
        [
            .toolCall(ToolCall(
                id: brief.child,
                name: "Agent",
                kind: .delegate,
                target: brief.said,
                narration: brief.said,
                atMs: TranscriptFixtures.handedOver(brief.minutesAgo * 60),
            )),
            .toolCallOutcome(TranscriptFixtures.launched(brief.child, subagent: brief.child)),
        ]
    }

    /// One handover: what it was, whose file it is, and how long ago the work was handed over.
    private struct EndedBrief {
        let said: String
        let child: String
        let minutesAgo: Int
    }

    /// The four the report showed, at the two ages it showed them at.
    private static let endedBriefs = [
        EndedBrief(said: "Spec review of #1343", child: "a-spec-1343", minutesAgo: 149),
        EndedBrief(said: "Standards review of #1343", child: "a-standards-1343", minutesAgo: 149),
        EndedBrief(said: "Spec review of #1344", child: "a-spec-1344", minutesAgo: 25),
        EndedBrief(said: "Standards review of #1344", child: "a-standards-1344", minutesAgo: 25),
    ]
}
