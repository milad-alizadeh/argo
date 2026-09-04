import ArgoEngine
@testable import ArgoUI
import Testing

/// Whether the Session that delegated a Subagent can still be driving it — the fact the rail's dots
/// were drawn without (#1076).
///
/// Both sides matter here. A status that reads running where the Session cannot be driving anything
/// is the untruth the ticket was written from; a status that reads quiet where the Session is
/// plainly alive is the same untruth pointed the other way, and it would put a green dot's absence
/// over a Subagent that really is out.
@Suite("Delegating session")
struct DelegatingSessionTests {
    /// The whole boundary, in one table. Every status answered, so one added to the domain fails
    /// here as well as at the switch that has to place it.
    @Test
    func `each status says whether the session can still be driving a subagent`() {
        let expected: [Reading] = [
            Reading(status: .starting, reads: .notRunning),
            Reading(status: .running, reads: .running),
            Reading(status: .permission, reads: .running),
            Reading(status: .asking, reads: .running),
            Reading(status: .idle, reads: .undecided),
            Reading(status: .stopped, reads: .notRunning),
            Reading(status: .ended, reads: .notRunning),
            Reading(status: .unknown, reads: .notRunning),
        ]

        #expect(expected.map(\.status) == SessionStatus.allCases)
        for row in expected {
            #expect(DelegatingSession.of(row.status) == row.reads, "\(row.status)")
        }
    }

    /// The ruling on #1076: a Session waiting on the READER is not ambiguous — its process is there
    /// and its Subagents are still out — so degrade-down does not apply to it.
    @Test
    func `a session waiting on the reader is still driving its subagents`() {
        #expect(DelegatingSession.of(.permission) == .running)
        #expect(DelegatingSession.of(.asking) == .running)
    }

    /// degrade-down: the contract has no colour for "we cannot say", so a Session Argo cannot
    /// observe reads as not running rather than as a green dot nothing witnessed. `stopped` and
    /// `ended` are the Sessions #1076 was written from — they have GONE, and a Session that has
    /// gone leaves nothing to be undecided about.
    @Test
    func `a session that cannot be driving anything is quiet`() {
        #expect(DelegatingSession.of(.unknown) == .notRunning)
        #expect(DelegatingSession.of(.stopped) == .notRunning)
        #expect(DelegatingSession.of(.ended) == .notRunning)
        #expect(DelegatingSession.of(.starting) == .notRunning)
    }

    /// And the one that is neither, which is what #1269 was written from: a parent that handed its
    /// whole fan-out over and is now waiting on it writes nothing, so it reads `idle` for exactly
    /// as long as its children work. Its silence is not an ending — reading it as one is what drew
    /// `0 running` over a feed the reader could watch move.
    @Test
    func `a session that has fallen quiet while waiting decides nothing`() {
        #expect(DelegatingSession.of(.idle) == .undecided)
        #expect(!DelegatingSession.of(.idle).isRunning)
    }

    /// The rail is drawn in rooms that resolve no Session at all, and no Session is the same
    /// absence of evidence.
    @Test
    func `no session at all is not running`() {
        #expect(DelegatingSession.of(nil) == .notRunning)
    }

    /// One status and what it says about the Subagents under it.
    private struct Reading {
        let status: SessionStatus
        let reads: DelegatingSession
    }
}
