import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The empty meter under a finished background chip (#1279).
///
/// A backgrounded delegation reports neither figure at either end (#908), so both slots under its
/// name were blank for the life of the record — the two review chips in the request's screenshot.
/// The child's OWN file, which Argo already holds (#858), states both.
@Suite("Feed agents meter")
@MainActor
struct FeedAgentsMeterTests {
    /// The bug, in one claim.
    @Test
    func `a finished background chip states its child's own time and tokens`() {
        let chips = Self.listing(of: .ended, reading: Self.ran)

        #expect(chips.map(\.activity) == [.finished])
        #expect(chips.first?.durationMs == 12000)
        #expect(chips.first?.spend?.spentTokens == 5600)
    }

    /// The running half: tokens read SO FAR are tokens spent so far, and that figure only grows. No
    /// duration, though — the chip is still counting up, and a total measured to here would replace
    /// a live clock with a frozen one (#1076, #1090).
    @Test
    func `a running background chip shows tokens and keeps counting up`() {
        let chips = Self.listing(of: .idle, reading: Self.ran, writing: [Self.child])

        #expect(chips.map(\.activity) == [.running])
        #expect(chips.first?.durationMs == nil)
        #expect(chips.first?.startedAtMs != nil)
        #expect(chips.first?.spend?.spentTokens == 5600)
    }

    /// Degrade down. A chip whose child Argo has not read draws an empty meter, which is the honest
    /// state — a `0` would claim the work was instant and free.
    @Test
    func `a chip with no reading measures nothing`() {
        let chips = Self.listing(of: .ended, reading: [])

        #expect(chips.first?.durationMs == nil)
        #expect(chips.first?.spend == nil)
    }

    /// DERIVED never outranks DIRECT. A synchronous agent's host-measured pair is what the host
    /// itself observed of the run, and it stands whatever the child's own file spans.
    @Test
    func `a reported total wins over the derived one`() {
        let reported = FeedAgent(
            id: 0,
            label: "verified",
            activity: .finished,
            spend: Usage(
                inputTokens: 1,
                outputTokens: 2,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            ),
            subagentID: Self.child,
            durationMs: 99,
            startedAtMs: 5,
        )

        let told = FeedAgents.told([reported], by: .measuring(Self.measured))

        #expect(told.first?.durationMs == 99)
        #expect(told.first?.spend?.spentTokens == 3)
        #expect(told.first?.startedAtMs == 5)
    }

    /// The two are filled independently: a record that stated one of them still gets the other.
    @Test
    func `a reported duration does not withhold a derived spend`() {
        let half = FeedAgent(
            id: 0,
            label: "half",
            activity: .finished,
            spend: nil,
            subagentID: Self.child,
            durationMs: 99,
        )

        let told = FeedAgents.told([half], by: .measuring(Self.measured))

        #expect(told.first?.durationMs == 99)
        #expect(told.first?.spend?.spentTokens == 5600)
    }

    /// ONE walk of the reading. The rail asks per chip on every pass, and the answer behind each is
    /// the child's whole file — a derivation per chip per frame is the cost #858 exists to have
    /// removed, reintroduced one level down.
    @Test
    func `the rail measures a child once, however many times it asks`() {
        SessionsRoomReadingCache.forget()
        let room = Self.room(of: .ended)
        let reader = FeedAgentReader(events: [Self.child: Self.ran]).stamped(room.stamp)

        let deck = reader.agents(in: room.feed)
        let toolbar = reader.agents(in: room.feed)

        #expect(deck == toolbar)
        #expect(SessionsRoomReadingCache.cost.measures == 1)
    }

    /// And the other half: the memo is keyed on the child's own LENGTH, so a Subagent that has
    /// written since is measured again. Keyed on the room's stamp alone it would freeze — that
    /// stamp does not move for a child's bytes.
    @Test
    func `a child that has written since is measured again`() {
        SessionsRoomReadingCache.forget()
        let room = Self.room(of: .ended)
        let opening = FeedAgentReader(events: [Self.child: Array(Self.ran.prefix(2))])
        let grown = FeedAgentReader(events: [Self.child: Self.ran])

        let first = opening.stamped(room.stamp).agents(in: room.feed)
        let second = grown.stamped(room.stamp).agents(in: room.feed)

        #expect(first.first?.durationMs == nil)
        #expect(second.first?.durationMs == 12000)
        #expect(SessionsRoomReadingCache.cost.measures == 2)
    }

    // MARK: - Fixtures

    /// The one Subagent this suite has a reading of.
    private static let child = "a-away"

    private static let measured = SubagentMeasure.read(ran)

    /// The child's own file: dated at both ends, and pricing two of its records.
    private static let ran: [TranscriptEvent] = [
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

    /// One backgrounded delegation, its receipt filed and no report behind it — the shape every
    /// chip the request was written from takes.
    private static let launched: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Agent", kind: .delegate, naming: "review")),
        .toolCallOutcome(TranscriptFixtures.launched("away", subagent: child)),
    ]

    /// The rail's list as the shell derives it: through the reader, stamped with a reading of a
    /// Session at this status.
    private static func listing(
        of status: SessionStatus,
        reading child: [TranscriptEvent],
        writing: Set<String> = [],
    )
        -> [FeedAgent] {
        SessionsRoomReadingCache.forget()
        let room = room(of: status)
        let reader = FeedAgentReader(
            events: child.isEmpty ? [:] : [Self.child: child],
            writing: writing,
        )
        return reader.stamped(room.stamp).agents(in: room.feed)
    }

    private static func room(of status: SessionStatus) -> SessionsRoomReading {
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
