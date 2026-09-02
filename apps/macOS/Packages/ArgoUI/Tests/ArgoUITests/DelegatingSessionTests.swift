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
            Reading(status: .starting, isRunning: false),
            Reading(status: .running, isRunning: true),
            Reading(status: .permission, isRunning: true),
            Reading(status: .asking, isRunning: true),
            Reading(status: .idle, isRunning: false),
            Reading(status: .stopped, isRunning: false),
            Reading(status: .ended, isRunning: false),
            Reading(status: .unknown, isRunning: false),
        ]

        #expect(expected.map(\.status) == SessionStatus.allCases)
        for row in expected {
            #expect(DelegatingSession.of(row.status).isRunning == row.isRunning, "\(row.status)")
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
    /// `ended` are the Sessions the ticket was written from.
    @Test
    func `a session that cannot be driving anything is quiet`() {
        #expect(DelegatingSession.of(.unknown) == .notRunning)
        #expect(DelegatingSession.of(.stopped) == .notRunning)
        #expect(DelegatingSession.of(.ended) == .notRunning)
        #expect(DelegatingSession.of(.idle) == .notRunning)
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
        let isRunning: Bool
    }
}
