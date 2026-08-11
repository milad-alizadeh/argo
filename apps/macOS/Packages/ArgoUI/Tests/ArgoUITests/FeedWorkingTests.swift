import ArgoEngine
@testable import ArgoUI
import Testing

/// The one live state the feed draws, and — mostly — the many it does not. Every claim below is
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
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: access,
            status: status,
            cli: .claude,
            events: events,
        )
    }

    @Test
    func `a Turn in progress is working`() {
        let session = Self.session(status: .running, events: [.message(markdown: "On it.")])
        #expect(FeedWorking.isWorking(session))
    }

    /// The whole point of the row. Every one of these is a Session that is NOT in flight, and a
    /// live-looking foot under any of them would be a claim nothing observed.
    @Test(arguments: [SessionStatus.idle, .permission, .asking, .stopped, .ended, .unknown])
    func `a Session that is not running says nothing about what it is doing`(
        status: SessionStatus,
    ) {
        let session = Self.session(status: status, events: [.message(markdown: "Done.")])
        #expect(!FeedWorking.isWorking(session))
    }

    /// The state this row deliberately does NOT claim. Argo owns the spawn but nothing tells it
    /// when the CLI finished booting — the record does not appear until the first prompt — so a
    /// managed Session with an empty reading is the engine's `idle` and stays it. A `starting…`
    /// row here would stand over a booted agent for the rest of the window's life.
    @Test
    func `a spawned Session that has written nothing is not working`() {
        #expect(!FeedWorking.isWorking(Self.session()))
    }

    /// Read off the status and nothing else, so an external Session gets the row on exactly the
    /// same evidence a managed one does — and loses it, honestly, the moment liveness degrades.
    @Test
    func `an external Session mid-turn is working on the same evidence`() {
        #expect(FeedWorking.isWorking(Self.session(access: .external, status: .running)))
    }

    @Test
    func `no Session selected is not a Session waiting`() {
        #expect(!FeedWorking.isWorking(nil))
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

    /// Under the work and above the three whole-session statements. It is the newest moment of the
    /// reading, so it holds the place the next row will take — which is what makes it read as the
    /// reading continuing rather than as a footnote about it.
    @Test
    func `the row sits under the work and above what the Session spent`() {
        let rows = FeedProjection.rows(from: Self.transcript, working: true)

        #expect(rows.last?.content == .mark(.spent(Self.spend)))
        #expect(rows.dropLast().last?.content == .mark(.working))
    }

    /// The commonest case by far, and the one a slot at the foot of every reading would break.
    @Test
    func `a Session that is doing nothing reads exactly as it did before`() {
        let rows = FeedProjection.rows(from: Self.transcript)

        #expect(rows.last?.content == .mark(.spent(Self.spend)))
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
            id: "call-1", status: .completed, result: nil, endedAtMs: nil, usage: nil,
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
        .prompt(text: "Clear the build folder", atMs: 1000),
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
