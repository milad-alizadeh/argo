import ArgoEngine
@testable import ArgoUI
import Testing

/// A Turn in flight, on the plinth (`cockpit-feed-waiting.md`, #1326) — the one wait the design
/// says twice on purpose, and the one that settles into nothing unless it fails.
@Suite("Feed turn wait")
@MainActor
struct FeedTurnWaitTests {
    private static func session(
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        events: [TranscriptEvent] = [],
        hasUnansweredTurn: Bool = false,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-1",
            title: "New session",
            access: access,
            status: status,
            chain: .init(program: .init(cli: .claude)),
            transcript: .init(events: events, hasUnansweredTurn: hasUnansweredTurn),
        )
    }

    /// One Session, in the shape the shell hands the reading.
    private static func reading(
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        events: [TranscriptEvent] = [],
        hasUnansweredTurn: Bool = false,
    )
        -> SessionsRoomReading {
        SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [session(
                    access: access, status: status, events: events,
                    hasUnansweredTurn: hasUnansweredTurn,
                )],
                connection: .idle,
            ),
            sessionID: "session-1",
        )
    }

    // MARK: - Both draw at once, on purpose

    /// The one place the design says a thing twice: the thread stays wordless while the plinth
    /// names the same wait in words.
    @Test
    func `a running Turn draws both the thread and a wordless plinth`() {
        let reading = Self.reading(
            status: .running, events: [.message(markdown: "Working…")],
            hasUnansweredTurn: true,
        )

        #expect(reading.feed.contains { $0.content == .mark(.working) })
        #expect(reading.hasUnansweredTurn)
        #expect(FeedWaitWords(.thinking)?.symbol == nil)
    }

    /// The DIRECT gate `EnvironmentValues.argoTurnIsDirect` carries down to `FeedColumn` — read off
    /// the engine's own `hasUnansweredTurn` (#1179) rather than re-derived from the status, so the
    /// reading says nothing where the fixture says nothing (degrade-down).
    @Test
    func `the reading carries whether the Turn in flight is Argo's own`() {
        #expect(!Self.reading(status: .running).hasUnansweredTurn)
        #expect(Self.reading(status: .running, hasUnansweredTurn: true).hasUnansweredTurn)
    }

    // MARK: - A Turn in flight settles into nothing, or one failed row

    /// The agent's answer IS the record of it: a Turn that ends the way it was meant to drops no
    /// row at all, beside the wordless `.mark(.turnEnded)` rule that already stands there (#1248).
    @Test
    func `a Turn that answers appends nothing but the rule`() {
        let rows = FeedProjection.rows(
            from: [.message(markdown: "Done."), .turnEnded(.endTurn)],
        ).map(\.content)

        #expect(rows == [.message("Done."), .mark(.turnEnded)])
    }

    /// The three stop reasons the design names, each naming the host's own word for it — beside
    /// the ordinary rule, never instead of it.
    @Test(arguments: [
        (StopReason.maxTokens, "max_tokens"),
        (StopReason.maxTurnRequests, "max_turn_requests"),
        (StopReason.refusal, "refusal"),
    ])
    func `a Turn that ends without answering lands one failed row`(
        outcome: (reason: StopReason, hostWord: String),
    ) {
        let rows = FeedProjection.rows(from: [.turnEnded(outcome.reason)]).map(\.content)

        #expect(rows.count == 2)
        #expect(rows.first == .mark(.turnEnded))
        guard case let .settledWait(settled) = rows.last else {
            Issue.record("No settled row landed for \(outcome.reason).")
            return
        }
        #expect(settled.wait == .thinking)
        #expect(settled.failure == outcome.hostWord)
        #expect(FeedWaitWords(settled.wait).failed == "The turn ended without an answer")
    }

    /// Neither a Turn that finished nor one somebody stopped is "without an answer" — `endTurn` is
    /// answered and `cancelled` already draws as `.interrupted` (#1189), and a reason this
    /// vocabulary could not read is not evidence either way.
    @Test(arguments: [StopReason.endTurn, .cancelled, .unknown])
    func `an answered or interrupted Turn lands no failed row`(reason: StopReason) {
        let rows = FeedProjection.rows(from: [.turnEnded(reason)]).map(\.content)

        #expect(!rows.contains { $0.isSettledWait })
    }

    // MARK: - What the wait is called

    /// The one place the design says a thing twice, deliberately — and the one wait with no mark.
    @Test
    func `the thinking wait names itself and takes no mark`() {
        #expect(FeedWaitWords.thinking.running == "Waiting for the agent to answer")
        #expect(FeedWaitWords.thinking.failed == "The turn ended without an answer")
        #expect(FeedWaitWords.thinking.symbol == nil)
    }

    /// A lit call takes the ion on its own line instead of a plinth — the one wait read off the
    /// rows that never stands beside `.thinking` (`cockpit-feed-waiting.md`).
    @Test
    func `a lit call raises no plinth, but thinking does`() {
        #expect(FeedWaitWords(.call(3)) == nil)
        #expect(FeedWaitWords(.thinking) == .thinking)
    }
}

private extension FeedRow.Content {
    /// One settled row is what the acceptance criterion counts, so the count needs a predicate.
    var isSettledWait: Bool {
        guard case .settledWait = self else { return false }
        return true
    }
}
