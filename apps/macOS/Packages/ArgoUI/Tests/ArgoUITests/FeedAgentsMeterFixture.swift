import ArgoEngine
import ArgoFixtures
@testable import ArgoUI

/// One backgrounded delegation and the child's own file behind it — what the meter suites both
/// read (#1279). Here rather than in either of them so the two cannot come to state different runs
/// and compare their answers to each other.
@MainActor
enum FeedAgentsMeterFixture {
    /// The one Subagent these suites have a reading of.
    static let child = "a-away"

    /// That child's file, measured — for a claim that needs the figures without a room around them.
    static let measured = SubagentMeasure.read(ran)

    /// The child's own file: dated at both ends, and pricing two of its records. Twelve seconds of
    /// span, and 5 600 fresh tokens.
    static let ran: [TranscriptEvent] = [
        .prompt(text: "Standards review of #1269", images: [], atMs: 1_700_000_000_000),
        .usage(Usage(
            inputTokens: 600,
            outputTokens: 2000,
            cacheReadTokens: 20000,
            cacheCreationTokens: 0,
        )),
        .toolCall(ToolCall(
            id: "read-1",
            name: "Read",
            kind: .read,
            target: "AgentMeter.swift",
            atMs: 1_700_000_004_000,
        )),
        .usage(Usage(
            inputTokens: 1000,
            outputTokens: 2000,
            cacheReadTokens: 30000,
            cacheCreationTokens: 0,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "read-1",
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: nil,
                endedAtMs: 1_700_000_012_000,
            ),
        )),
    ]

    /// The parent's record: one backgrounded delegation, its receipt filed and no report behind it
    /// — the shape every chip the request was written from takes.
    static let launched: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Agent", kind: .delegate, naming: "review")),
        .toolCallOutcome(TranscriptFixtures.launched("away", subagent: child)),
    ]

    /// The rail's list as the shell derives it: through the reader, stamped with a reading of a
    /// Session at this status.
    static func listing(
        of status: SessionStatus,
        reading events: [TranscriptEvent],
        writing: Set<String> = [],
    )
        -> [FeedAgent] {
        SessionsRoomReadingCache.forget()
        let room = room(of: status)
        let reader = FeedAgentReader(
            events: events.isEmpty ? [:] : [child: events],
            writing: writing,
        )
        return reader.stamped(room.stamp).agents(in: room.feed)
    }

    static func room(of status: SessionStatus) -> SessionsRoomReading {
        SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [CockpitPresentation.Session(
                    id: "one",
                    title: "one",
                    access: .managed,
                    status: status,
                    transcript: .init(events: launched),
                )],
                connection: .idle,
            ),
            sessionID: "one",
        )
    }
}
