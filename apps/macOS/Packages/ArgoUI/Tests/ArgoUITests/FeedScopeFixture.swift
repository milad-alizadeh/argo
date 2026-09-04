import ArgoEngine
import ArgoFixtures
@testable import ArgoUI

/// One Session that fanned out: three delegations, one still running — which is what keeps the rail
/// on screen at all — and two landed with a record each, the pair a reader clicks between.
///
/// Read through `SessionsRoomReading` and handed the reader the SHELL carries (#858), stamped with
/// that reading — an unstamped one derives every answer, which is a path the running app never
/// takes. The reader is fixture-backed here, which is the specimen's path and not the engine's:
/// what these suites are about is the deck, not where the bytes came from.
@MainActor
enum FeedScopeFixture {
    static let saidByOne = "The first agent reported back."
    static let saidByTwo = "The second agent reported back."

    /// The cache is static, so a suite that means to count derivations empties it first — and one
    /// that only means to read rows still must not inherit another suite's entries.
    ///
    /// `grown` appends that many lines to the Session's own record, which is what a running Session
    /// does under the reader: it moves the stamp every one of these readings is remembered under.
    static func fanOut(grown: Int = 0, forgetting: Bool = true) -> SessionsRoomReading {
        if forgetting {
            SessionsRoomReadingCache.forget()
        }
        return SessionsRoomReading(presentation: presentation(grown: grown), sessionID: "one")
    }

    /// Which chip stands for one Subagent's record. The rail addresses a chip by its DELEGATION, so
    /// the id is looked up rather than written down.
    static func chip(_ subagent: String, in reading: SessionsRoomReading) -> FeedAgent.ID? {
        reader(for: reading).agents(in: reading.feed).first { $0.subagentID == subagent }?.id
    }

    /// The Subagent reader as the shell hands it down: the fixture's records, stamped with the
    /// reading they are being drawn beside — see `CockpitView+Detail`.
    static func reader(for reading: SessionsRoomReading) -> FeedAgentReader {
        FeedAgentReader(events: records).stamped(reading.stamp)
    }

    /// Two lines for the second agent, not one: the rows a scope draws have to be tellable apart
    /// from the other agent's by COUNT, which is all the table can be asked for.
    static let records: [String: [TranscriptEvent]] = [
        "a-one": [.message(markdown: saidByOne)],
        "a-two": [.message(markdown: saidByTwo), .message(markdown: saidByTwo)],
    ]

    static func presentation(grown: Int = 0) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [session(grown: grown)],
            connection: .idle,
        )
    }

    private static func session(grown: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "one",
            title: "one",
            access: .managed,
            status: .running,
            transcript: .init(
                events: events + (0 ..< grown).map { .message(markdown: "Line \($0).") },
            ),
        )
    }

    private static let events: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Task", kind: .delegate, naming: "run")),
        .toolCall(FeedFixture.call("one", tool: "Task", kind: .delegate, naming: "read")),
        .toolCallOutcome(TranscriptFixtures.spent("one", FeedFixture.delegated, subagent: "a-one")),
        .toolCall(FeedFixture.call("two", tool: "Task", kind: .delegate, naming: "sift")),
        .toolCallOutcome(TranscriptFixtures.spent("two", FeedFixture.delegated, subagent: "a-two")),
    ]
}
