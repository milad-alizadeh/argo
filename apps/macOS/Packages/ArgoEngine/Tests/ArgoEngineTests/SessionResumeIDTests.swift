@testable import ArgoEngine
import Foundation
import Testing

/// Which link of the chain `--resume` is given (#10). A Session's own id is its ROOT's, and
/// resuming that would fork the chain where its first continuation left it — so this is the one
/// value in the resume path that cannot be read off the Session's id.
@Suite("Session resume id")
@MainActor
struct SessionResumeIDTests {
    @Test
    func `an unresumed Session resumes from its only file`() {
        let session = HubSession(observation: hubTestObservation(id: "root", events: []))

        #expect(session.resumeID == "root")
    }

    /// `claude` names each transcript after the session id it wrote it under, so the tip's filename
    /// IS the argument.
    @Test
    func `a chain resumes from its latest link, not its root`() {
        var session = HubSession(observation: hubTestObservation(id: "root", events: []))
        let second = HubSession(observation: hubTestObservation(id: "second", events: []))
        let third = HubSession(observation: hubTestObservation(id: "third", events: []))

        session.mergeContinuation(second)
        session.mergeContinuation(third)

        // The id everything links against stays the root's; only the resume target moves.
        #expect(session.id == "root")
        #expect(session.resumeID == "third")
    }

    /// A spawn Argo published a row for has no file yet, so there is no chain to continue — which
    /// is the refusal `SessionResumeError.noChainToResume` states.
    @Test
    func `a Session whose CLI wrote nothing has no resume id`() {
        let spawn = AgentSpawn(
            claim: SessionOwnership.ClaimID(value: "claim-1"),
            cli: .claude,
            cwd: "/tmp/argo",
            spawnedAtMs: 1000,
            mode: .code,
        )

        #expect(HubSession(spawn: spawn).resumeID == nil)
    }
}
