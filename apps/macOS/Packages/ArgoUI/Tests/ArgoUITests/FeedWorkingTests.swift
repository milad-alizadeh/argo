import ArgoEngine
@testable import ArgoUI
import Testing

/// The two live states the feed draws, and — mostly — the many it does not. Every claim below is
/// about a row that says something is in flight, so the ones that matter most are the cases where
/// nothing is and the row is absent: a feed reading `working…` over a Session sitting at its prompt
/// is worse than the silence it replaced.
@Suite("Feed working")
struct FeedWorkingTests {
    private static func session(
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        events: [TranscriptEvent] = [],
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-1",
            title: "New session",
            access: access,
            status: status,
            chain: .init(program: .init(cli: .claude)),
            work: .init(location: "/Users/milad/Developer/argo"),
            transcript: .init(events: events),
        )
    }

    /// The whole point of both rows, in one table: every status that is NOT in flight, and every
    /// one that is no evidence of a CLI still coming up. A live-looking foot under any of them
    /// would be a claim nothing observed.
    @Test
    func `each status says exactly what it is evidence of`() {
        let expected: [Evidence] = [
            Evidence(status: .starting, working: false, starting: true),
            Evidence(status: .running, working: true, starting: false),
            Evidence(status: .permission, working: false, starting: false),
            Evidence(status: .asking, working: false, starting: false),
            Evidence(status: .idle, working: false, starting: false),
            Evidence(status: .stopped, working: false, starting: false),
            Evidence(status: .ended, working: false, starting: false),
            Evidence(status: .unknown, working: false, starting: false),
        ]

        // Every status answered, so one added to the domain fails here rather than quietly
        // inheriting a neighbour's reading.
        #expect(expected.map(\.status) == SessionStatus.allCases)
        for row in expected {
            let session = Self.session(status: row.status, events: [.message(markdown: "Done.")])
            #expect(FeedWorking.isWorking(session.status) == row.working, "\(row.status)")
            #expect(FeedWorking.isStarting(session.status) == row.starting, "\(row.status)")
        }
    }

    /// One status and the two live readings it is evidence of.
    private struct Evidence {
        let status: SessionStatus
        let working: Bool
        let starting: Bool
    }

    /// `starting` is the engine's reading and never re-derived here: "managed with an empty
    /// reading" has no end, since the record does not appear until the first prompt (#587).
    @Test
    func `a spawned Session that has written nothing is neither, on its emptiness alone`() {
        #expect(!FeedWorking.isWorking(Self.session().status))
        #expect(!FeedWorking.isStarting(Self.session().status))
    }

    @Test
    func `no Session selected is no Session waiting`() {
        #expect(!FeedWorking.isWorking(nil))
        #expect(!FeedWorking.isStarting(nil))
    }

    /// The row `starting` exists for: a spawn's reading is empty by construction, so without it the
    /// feed draws `FeedSilence` — true, and identical to what a Session at its prompt draws.
    @Test
    func `a Session still starting has that as its whole reading`() {
        #expect(FeedProjection.rows(from: [], starting: true).map(\.content) == [.mark(.starting)])
        #expect(FeedProjection.rows(from: []).isEmpty)
    }

    /// On screen as well as to a reader, because a hairline with nothing in it already means a Turn
    /// ended — this state cannot borrow the working thread's silence.
    @Test
    func `the starting row says what it is waiting for`() {
        #expect(FeedMark.starting.words == "starting the agent")
        #expect(FeedMark.starting.spoken == "The agent is starting")
    }

    /// A CLI coming up is no Turn boundary, whatever a rule across the column looks like.
    @Test
    func `the starting row ends no Turn`() {
        #expect(!FeedMark.starting.endsTurn)
    }

    /// Read off the status and nothing else, so an external Session gets the row on exactly the
    /// same evidence a managed one does — and loses it, honestly, the moment liveness degrades.
    @Test
    func `an external Session mid-turn is working on the same evidence`() {
        #expect(FeedWorking.isWorking(Self.session(access: .external, status: .running).status))
    }

    /// The thread says it now, and it says it with no words at all. A caption here would sit in a
    /// hairline, and a hairline with nothing in it already means a Turn ENDED.
    @Test
    func `the state has no words on screen`() {
        #expect(FeedMark.working.words == nil)
    }

    /// Taking the word off the screen must not take it off the screen reader.
    @Test
    func `the state is spoken as a sentence rather than as its caption`() {
        #expect(FeedMark.working.spoken == "The agent is working")
    }

    /// Under the work the record holds. It is the newest moment of the reading, so it holds the
    /// place the next row will take — which is what makes it read as the reading continuing rather
    /// than as a footnote about it.
    @Test
    func `the row sits under the work the record holds`() {
        let rows = FeedProjection.rows(from: Self.transcript, working: true)

        #expect(rows.last?.content == .mark(.working))
        #expect(rows.dropLast().last?.content == .message("Running that now."))
    }

    /// The commonest case by far, and the one a slot at the foot of every reading would break.
    @Test
    func `a Session that is doing nothing reads exactly as it did before`() {
        let rows = FeedProjection.rows(from: Self.transcript)

        #expect(rows.last?.content == .message("Running that now."))
        #expect(rows.allSatisfy { $0.content != .mark(.working) })
    }

    /// The two live states are EXCLUSIVE, driven through the swap in both directions. Drawing both
    /// would claim two waits where the record has one, and drawing neither would lose the Turn: at
    /// every step of a Turn that runs a command, gets its answer, and runs another, exactly one of
    /// the thread and a lit row is up.
    @Test
    func `a running Turn draws the thread or a lit call and never both`() {
        // Thinking, then a call in flight, then the answer, then the next call.
        for step in Self.turn {
            let rows = FeedProjection.rows(from: Self.transcript + step, working: true)
            let at = "\(step.count) event(s) into the Turn"
            #expect(rows.hasThread != rows.hasCallInFlight, "both or neither, \(at)")
        }
    }

    /// What the age of a wait is counted from. Each step is a different wait, so each is a change
    /// here — and a Turn that runs a command, gets its answer and runs another crosses three of
    /// them without the reading ever showing two waits at once.
    @Test
    func `every handover is a new wait to count from`() {
        let waits = Self.turn.map { step in
            FeedWait.showing(in: FeedProjection.rows(from: Self.transcript + step, working: true))
        }

        #expect(waits[0] == .thinking)
        #expect(waits[1] != .thinking)
        #expect(waits[1] != nil)
        #expect(waits[2] == .thinking)
        // The second command is its own wait, not a continuation of the first: a call that has run
        // ninety seconds and the one after it must not share a count.
        #expect(waits[3] != waits[1])
    }

    /// A think that says something and goes on thinking is ONE wait. The count is keyed on the
    /// state and not on the row that draws it, so an arriving row does not hand a six-minute
    /// think back to the first rung.
    @Test
    func `a row arriving mid-think does not restart the wait`() {
        let before = FeedProjection.rows(from: Self.transcript, working: true)
        let after = FeedProjection.rows(
            from: Self.transcript + [.message(markdown: "Still going.")],
            working: true,
        )

        #expect(before.count != after.count)
        #expect(FeedWait.showing(in: before) == FeedWait.showing(in: after))
    }

    /// Nothing in flight is nothing to count. A reading with no wait must hand the surfaces no
    /// clock at all — this is the state the timer cost is judged against.
    @Test
    func `a reading with nothing in flight shows no wait`() {
        #expect(FeedWait.showing(in: FeedProjection.rows(from: Self.transcript)) == nil)
    }

    /// A Turn that runs a command, gets its answer and runs another, one step at a time. Every
    /// claim about the handover is driven through the same four steps, so no two of them can be
    /// asserting about different Turns.
    private static let turn: [[TranscriptEvent]] = {
        let asked = TranscriptEvent.toolCall(ToolCall(
            id: "call-1", name: "shell", kind: .execute, target: "swift test", atMs: nil,
        ))
        let answered = TranscriptEvent.toolCallOutcome(ToolCallOutcome(
            id: "call-1",
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: nil,
                endedAtMs: nil,
            ),
        ))
        let again = TranscriptEvent.toolCall(ToolCall(
            id: "call-2", name: "shell", kind: .execute, target: "swift build", atMs: nil,
        ))
        return [[], [asked], [asked, answered], [asked, answered, again]]
    }()

    private static let spend = Usage(
        inputTokens: 12,
        outputTokens: 34,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
    )

    private static let transcript: [TranscriptEvent] = [
        .prompt(text: "Clear the build folder", images: [], atMs: 1000),
        .message(markdown: "Running that now."),
        .usage(spend),
    ]
}

private extension [FeedRow] {
    /// The thread's row — the whole-measure signal that stands when nothing is pending.
    var hasThread: Bool {
        contains { $0.content == .mark(.working) }
    }

    /// A row the ion crosses, which is any call the record has not answered yet.
    var hasCallInFlight: Bool {
        contains { row in
            guard case let .call(call) = row.content else { return false }
            return call.ending == .pending
        }
    }
}
