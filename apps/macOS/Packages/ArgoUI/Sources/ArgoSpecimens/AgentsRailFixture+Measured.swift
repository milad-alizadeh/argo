import ArgoEngine
import ArgoFixtures
import ArgoUI

extension AgentsRailFixture {
    /// The state #1279 was written from: three backgrounded delegations, none of which REPORTED a
    /// time or a spend, and the meter under each drawn from what Argo can read of the child itself.
    ///
    /// The three chips are the three answers, in one still:
    ///
    /// - one the record ANSWERED, whose figures are the span and the roll-up of its own file;
    /// - one still writing, which shows the tokens read so far and goes on counting up, because a
    ///   total measured to here would freeze a live clock;
    /// - one Argo has no reading of at all, whose meter is EMPTY — degrade-down, where a `0` would
    ///   claim the work was instant and free.
    static let measuredRows = FeedProjection.rows(from: measured)

    /// Those records read as a WAITING parent's, with the two children Argo holds a file for and
    /// the third named by nothing. `of: .undecided` is what an `idle` parent projects to, so it
    /// decides none of the three and each chip is settled by its own evidence.
    static let measuredReadings = FeedAgentReader(
        events: Dictionary(
            uniqueKeysWithValues: axes.compactMap { axis in
                axis.reading.map { (axis.child, $0) }
            },
        ),
        of: .undecided,
        writing: Set(axes.filter(\.isWriting).map(\.child)),
    )

    private static let measured: [TranscriptEvent] = [
        .prompt(
            text: "Review the diff on three axes, one agent each.",
            images: [],
            atMs: 1_733_000_000_000,
        ),
        .message(markdown: "Three agents out, one per axis. I will wait for all three."),
    ]
        + axes.flatMap(delegation)

    /// One backgrounded delegation as the record leaves it: the handover, the receipt that resolves
    /// nothing (#908), and — for the one that came back — the late report, which ANSWERS the call
    /// and states neither figure.
    private static func delegation(_ axis: ReviewAxis) -> [TranscriptEvent] {
        [
            .toolCall(ToolCall(
                id: axis.child,
                name: "Agent",
                kind: .delegate,
                target: axis.said,
                narration: axis.said,
                atMs: TranscriptFixtures.handedOver(axis.minutesAgo * 60),
            )),
            .toolCallOutcome(TranscriptFixtures.launched(axis.child, subagent: axis.child)),
        ] + (axis.hasReported ? [.toolCallOutcome(reported(axis.child))] : [])
    }

    /// The late report, in the shape the rail actually gets one: it closes the call and carries no
    /// `usage` and no duration — the whole reason a finished background chip drew nothing.
    private static func reported(_ id: String) -> ToolCallOutcome {
        ToolCallOutcome(
            id: id,
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: nil,
                endedAtMs: nil,
            ),
            delegated: ToolCallOutcome.Delegated(usage: nil, subagentID: id),
        )
    }

    /// One axis: what it was, whose file it is, and where the delegation stands.
    private struct ReviewAxis {
        let said: String
        let child: String
        let minutesAgo: Int
        let standing: Standing

        var reading: [TranscriptEvent]? {
            switch standing {
            case let .reported(events), let .writing(events): events
            case .unread: nil
            }
        }

        var isWriting: Bool {
            if case .writing = standing {
                return true
            }
            return false
        }

        var hasReported: Bool {
            if case .reported = standing {
                return true
            }
            return false
        }
    }

    /// Where one backgrounded delegation stands, and the file behind it. One value rather than two
    /// flags and an optional, because the three cases are exclusive: a child cannot be both still
    /// writing and answered, and the one nobody has read has no file to carry.
    private enum Standing {
        /// The report landed and closed the call, stating neither figure — and this is the record
        /// the child left behind, which is where both now come from.
        case reported([TranscriptEvent])
        /// Still going, with this much of its file arrived so far.
        case writing([TranscriptEvent])
        /// No report, no growth, and nothing read.
        case unread
    }

    private static let axes = [
        ReviewAxis(
            said: "Standards review of #1269",
            child: "m-standards",
            minutesAgo: 9,
            // Dated at both ends and pricing three of its records: the finished chip's whole meter.
            standing: .reported(ran(seconds: 223, requests: 3)),
        ),
        ReviewAxis(
            said: "Spec review of #1269",
            child: "m-spec",
            minutesAgo: 4,
            // Still going, so it has priced less — the running chip's figure is what was read SO
            // FAR, and its duration is still the count-up rather than this span.
            standing: .writing(ran(seconds: 96, requests: 1)),
        ),
        // The one Argo has no file for: no report, nothing written, nothing read. Its meter is the
        // empty one, which is the honest state and the third thing this still has to show.
        ReviewAxis(
            said: "Test review of #1269",
            child: "m-tests",
            minutesAgo: 4,
            standing: .unread,
        ),
    ]

    /// One child's own record, spanning `seconds` and pricing `requests` of its assistant records.
    /// Dated relative to NOW for the reason `TranscriptFixtures.handedOver` is: the chips beside it
    /// count up from a real clock.
    private static func ran(seconds: Int, requests: Int) -> [TranscriptEvent] {
        let opened = TranscriptFixtures.handedOver(seconds)
        return [.prompt(text: "Review the diff", images: [], atMs: opened)]
            + (0 ..< requests).flatMap { request in
                [
                    TranscriptEvent.usage(Usage(
                        inputTokens: 1200,
                        outputTokens: 9400,
                        cacheReadTokens: 120_000,
                        cacheCreationTokens: 0,
                    )),
                    .toolCall(ToolCall(
                        id: "\(request)-read",
                        name: "Read",
                        kind: .read,
                        target: "Sources/ArgoUI/Shell/Deck/Feed/Agents/AgentMeter.swift",
                        atMs: opened + (request + 1) * seconds * 1000 / requests,
                    )),
                ]
            }
    }
}
