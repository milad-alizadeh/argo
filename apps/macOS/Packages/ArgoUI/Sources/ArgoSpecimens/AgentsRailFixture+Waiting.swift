import ArgoEngine
import ArgoFixtures
import ArgoUI

extension AgentsRailFixture {
    /// The state #1269 was written from, and the one no fixture held: a parent that handed its
    /// whole fan-out over and is now WAITING on it.
    ///
    /// Neither `quiet` nor `stale` can show it, because in both of those the parent's status
    /// decided the chips. Here it decides nothing, and every earlier reading of these rows said
    /// `0 running` with three quiet dots while two of the children were writing.
    ///
    /// What settles it in pixels is the three chips together: two drawn running off their own
    /// records, and one drawn UNKNOWN — an outlined dot and no clock. The third is what keeps the
    /// render honest about the fix's shape: the evidence settles the chips it reaches, and the rail
    /// says so about the one it does not.
    static let waitingRows = FeedProjection.rows(from: waiting)

    /// Those records read as a WAITING Session's: `of: .undecided` is what the parent's `idle`
    /// status projects to, and `writing` names the two children whose files Argo has watched grow.
    static let waitingReadings = FeedAgentReader(
        events: Dictionary(uniqueKeysWithValues: briefs.map { ($0.child, verifier) }),
        of: .undecided,
        growth: StatedGrowth(writing: Set(briefs.filter(\.isWriting).map(\.child))),
    )

    private static let waiting: [TranscriptEvent] = [
        .prompt(
            text: "Review the diff on three axes, one agent each.",
            images: [],
            atMs: 1_733_000_000_000,
        ),
        .message(markdown: "Three agents out, one per axis. I will wait for all three."),
    ]
        + briefs.flatMap(delegation)

    /// One backgrounded delegation as the record leaves it: the handover, and the receipt that
    /// resolves nothing (#908). Each names a Subagent of its OWN, which is what lets one of the
    /// three be a child Argo has no growth for while the other two are writing.
    private static func delegation(_ brief: Brief) -> [TranscriptEvent] {
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

    /// One handover: what it was, whose file it is, and whether Argo has watched that file grow.
    private struct Brief {
        let said: String
        let child: String
        let minutesAgo: Int
        let isWriting: Bool
    }

    private static let briefs = [
        Brief(said: "Spec review of #1223 diff", child: "a-spec", minutesAgo: 6, isWriting: true),
        Brief(
            said: "Standards review of #1223 diff",
            child: "a-standards",
            minutesAgo: 6,
            isWriting: true,
        ),
        // The one Argo cannot place: its file has said nothing since the cockpit opened, and the
        // parent's silence says nothing about it either.
        Brief(said: "Test review of #1223 diff", child: "a-tests", minutesAgo: 6, isWriting: false),
    ]
}
