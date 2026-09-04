import ArgoEngine
@testable import ArgoUI
import Testing

/// Where the next Turn goes — straight to the Session, or onto the queue above the field.
///
/// Its own suite because the decision is not the status WORD (#1179): `running` is one of eight
/// words and the DERIVED one, and a Session Argo has just typed a Turn at, or one whose process
/// has not spoken yet, is working and reads something else. Both used to send the next Turn down
/// a busy PTY, draw no chip, and leave what was typed nowhere at all.
///
/// It is not `hasTurnEnded` either, which is the RELEASE and wider still (#1238) — the two are
/// asserted against each other here, because a reading that answered both questions would either
/// strand a follow-up or swallow an answer.
@Suite("Session composer in flight")
struct SessionComposerInFlightTests {
    /// The void, one word at a time. `starting` is a process Argo launched and has not heard;
    /// `permission` is a CLI holding a prompt a typed line would be eaten by.
    @Test(arguments: [SessionStatus.starting, .permission])
    func `a working Session that does not read running still queues the next Turn`(
        status: SessionStatus,
    ) throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(status: status)),
        )

        #expect(composer.isTurnInFlight)
        #expect(composer.placeholder == SessionComposerProjection.queuePlaceholder)
    }

    /// Argo's own submit outranks the word, which is the half a channel can overrule: a drive port
    /// or a companion reporting `idle` over a Turn Argo has just typed would otherwise put the next
    /// one down the same busy PTY (#1048, #1179).
    @Test
    func `a Turn Argo typed and nothing has answered is in flight whatever the word says`() throws {
        let composer = try #require(SessionComposerProjection.composer(
            for: session(status: .idle, hasUnansweredTurn: true),
        ))

        #expect(composer.isTurnInFlight)
    }

    /// `asking` is the one working status that must NOT queue: the live question is answered
    /// THROUGH this field, so a Return held there is an answer the agent never hears (#1238).
    @Test
    func `a live question takes the next words itself, because it is the answer`() throws {
        let composer = try #require(SessionComposerProjection
            .composer(for: session(status: .asking)))

        #expect(!composer.isTurnInFlight)
        // And the release still waits, which is the pair that makes it work: what was queued
        // BEHIND the Turn goes on waiting while the answer goes now.
        #expect(!composer.hasTurnEnded)
    }

    /// `unknown` must not queue either, and for the opposite reason: by its own definition nothing
    /// will move it, so a follow-up held there would wait forever. `hasTurnEnded` reads it as an
    /// end for the same reason (#1238).
    @Test
    func `a status nothing will move takes the next words rather than stranding them`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(status: .unknown)),
        )

        #expect(!composer.isTurnInFlight)
        #expect(composer.hasTurnEnded)
    }

    /// The other side of it, which is what keeps the queue from swallowing every Turn.
    @Test(arguments: [SessionStatus.idle, .stopped])
    func `a Session observed to have stopped takes the next words itself`(
        status: SessionStatus,
    ) throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(status: status)),
        )
        #expect(!composer.isTurnInFlight)
    }

    /// Every status this suite queues at is one the RELEASE will eventually fire for — asserted as
    /// a pair rather than left to be noticed, because a queue that never releases is its own void:
    /// the words are drawn, and nothing can ever deliver them.
    @Test(arguments: [SessionStatus.starting, .permission, .running])
    func `every status that queues is one the release still comes for`(
        status: SessionStatus,
    ) throws {
        let working = try #require(
            SessionComposerProjection.composer(for: session(status: status)),
        )
        try #require(working.isTurnInFlight)
        // Held, not released — the Turn has not ended at any of them.
        #expect(!working.hasTurnEnded)

        let settled = try #require(SessionComposerProjection.composer(for: session(status: .idle)))

        #expect(settled.hasTurnEnded)
    }

    private func session(
        status: SessionStatus,
        hasUnansweredTurn: Bool = false,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-a",
            title: "Restore the sessions Warp closed",
            access: .managed,
            status: status,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5", effort: "medium")),
            transcript: .init(hasUnansweredTurn: hasUnansweredTurn),
        )
    }
}
