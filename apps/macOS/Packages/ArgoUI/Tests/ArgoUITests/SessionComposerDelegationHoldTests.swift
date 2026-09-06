import ArgoEngine
@testable import ArgoUI
import Testing

/// The composer under a Turn that a backgrounded delegation is holding open (#1267).
///
/// Its own suite beside `SessionComposerInFlightTests`, because it is the case that suite's three
/// readings cannot answer between them: the Session genuinely reads `running`, no channel is lying
/// about it, and Argo typed nothing — the record's open Turn is a child's, and the parent's prompt
/// has been free since the launch receipt came back (#908).
@Suite("Session composer delegation hold")
struct SessionComposerDelegationHoldTests {
    @Test
    func `a Turn held open by a handed-off child does not put the field in queue-only mode`()
        throws {
        let composer = try #require(SessionComposerProjection.composer(for: session(held: true)))

        #expect(!composer.isTurnInFlight)
        #expect(composer.placeholder != SessionComposerProjection.queuePlaceholder)
    }

    /// The other half of what stranded the reader: a queue with no boundary coming for it (#1238).
    @Test
    func `whatever is already queued is released rather than held for a report that is lost`()
        throws {
        let composer = try #require(SessionComposerProjection.composer(for: session(held: true)))

        #expect(composer.hasTurnEnded)
    }

    /// The two run-settings knobs, drawn inert under `running` because the CLI's prompt is busy
    /// (#1217) — and it is not.
    @Test
    func `the prompt takes a typed line, because the parent handed the work off`() throws {
        let composer = try #require(SessionComposerProjection.composer(for: session(held: true)))

        #expect(composer.takesTypedLine)
    }

    /// The status WORD is deliberately untouched. The record's Turn IS open, the rail goes on
    /// saying a child is out, and taking that away is the reader's own gesture rather than this
    /// reading's.
    @Test
    func `the Session still reads running — only the composer stops queueing behind it`() throws {
        let composer = try #require(SessionComposerProjection.composer(for: session(held: true)))

        #expect(composer.isRunning)
    }

    /// And the pair beside it, which is what the footer draws Send off: the word stands, and none
    /// of what it was read from is the parent's own work (#1267).
    @Test
    func `the footer has nothing to stop, because the Turn it would stop is a child's`() throws {
        let held = try #require(SessionComposerProjection.composer(for: session(held: true)))
        #expect(held.isHeldByDelegation)

        let running = try #require(SessionComposerProjection.composer(for: session(held: false)))

        #expect(!running.isHeldByDelegation)
    }

    /// A Turn Argo itself typed outranks the hold, on `hasUnansweredTurn`'s own ground (#1179): a
    /// child out at the same time says nothing about the words the reader just sent.
    @Test
    func `a Turn Argo typed is still in flight with a child out beside it`() throws {
        let composer = try #require(SessionComposerProjection.composer(
            for: session(held: true, hasUnansweredTurn: true),
        ))

        #expect(composer.isTurnInFlight)
        #expect(!composer.hasTurnEnded)
    }

    /// And the ordinary running Session is untouched, which is what keeps this from being a queue
    /// that never queues.
    @Test
    func `a running Session with nothing handed off still queues the next Turn`() throws {
        let composer = try #require(SessionComposerProjection.composer(for: session(held: false)))

        #expect(composer.isTurnInFlight)
        #expect(!composer.hasTurnEnded)
        #expect(composer.placeholder == SessionComposerProjection.queuePlaceholder)
    }

    /// One `running` Session, with or without the child that is holding its Turn open.
    private func session(
        held: Bool,
        hasUnansweredTurn: Bool = false,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-a",
            title: "Review the diff",
            access: .managed,
            status: .running,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5", effort: "medium")),
            transcript: transcript(held: held, hasUnansweredTurn: hasUnansweredTurn),
        )
    }

    /// The record's two Turn readings, stated. `delegationHold` is set after the init, as the
    /// projection sets it (`swift-boundaries` edge 6).
    private func transcript(
        held: Bool,
        hasUnansweredTurn: Bool,
    )
        -> CockpitPresentation.Session.Transcript {
        var transcript = CockpitPresentation.Session
            .Transcript(submittedTurn: hasUnansweredTurn ? "a Turn nothing has answered" : nil)
        transcript.delegationHold = held
            ? DelegationHold(backgrounded: ["call-1"], isAlone: true)
            : .none
        return transcript
    }
}
