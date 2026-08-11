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

    /// `working`, never `thinking`: the record cannot tell reasoning from a command running.
    @Test
    func `the words name the wait and never what the agent is doing in it`() {
        #expect(FeedMark.working.words == "working…")
    }

    /// A caption let into a hairline is a shape, and the ellipsis carrying the whole meaning is
    /// exactly what a screen reader drops.
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
