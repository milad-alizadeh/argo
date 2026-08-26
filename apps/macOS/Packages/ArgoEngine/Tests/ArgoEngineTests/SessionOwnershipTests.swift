@testable import ArgoEngine
import Testing

/// The `managed | external` axis as a read rather than a literal — which is what stops the roster's
/// read-only lock from being a decision made in the view.
@Suite("Session ownership")
@MainActor
struct SessionOwnershipTests {
    /// The transcript a spawn is told to write, and the id the roster carries for that file.
    private let uuid = "11111111-2222-3333-4444-555555555555"
    private let sessionID = "/tmp/argo/11111111-2222-3333-4444-555555555555.jsonl"

    /// A clock the test moves by hand, so a claim's window is a fact rather than a race.
    private final class Clock {
        var nowMs = 1000
    }

    private func registry() -> (SessionOwnership, Clock) {
        let clock = Clock()
        return (SessionOwnership(now: { clock.nowMs }), clock)
    }

    @Test
    func `a Session nothing claimed is external`() {
        let (ownership, _) = registry()

        #expect(ownership.provenance(sessionID: sessionID) == .external)
    }

    @Test
    func `a spawn's own transcript is managed once it appears`() {
        let (ownership, clock) = registry()
        _ = ownership.claim(naming: uuid)
        clock.nowMs = 2000
        ownership.bind(sessionID: sessionID, uuid: uuid)

        #expect(ownership.provenance(sessionID: sessionID) == .managed)
    }

    @Test
    func `a claim whose PTY has exited leaves the Session orphaned`() {
        let (ownership, clock) = registry()
        let claim = ownership.claim(naming: uuid)
        ownership.bind(sessionID: sessionID, uuid: uuid)
        clock.nowMs = 2000
        ownership.release(claim)
        clock.nowMs = 3000

        // Observation survives the PTY; steering does not — until the chain is resumed (#10).
        #expect(ownership.provenance(sessionID: sessionID) == .orphaned)
    }

    /// The whole of #742: Argo shares its folders with agents nobody here started, and a claim open
    /// in one of them must not adopt whatever appears. Nothing but the named transcript will do.
    @Test
    func `an agent Argo did not name is external, however close to a claim it ran`() {
        let (ownership, clock) = registry()
        _ = ownership.claim(naming: uuid)
        clock.nowMs = 2000

        let stranger = "/tmp/argo/99999999-9999-9999-9999-999999999999.jsonl"
        #expect(ownership.bind(sessionID: stranger, uuid: "99999999-9999-9999-9999-999999999999")
            == nil)
        #expect(ownership.provenance(sessionID: stranger) == .external)
    }

    /// A CLI Argo cannot hand an id to owns a PROCESS and never a Session, so its claim adopts
    /// nothing at all rather than the nearest unnamed transcript.
    @Test
    func `a claim that named no transcript binds nothing`() {
        let (ownership, _) = registry()
        _ = ownership.claim()

        #expect(ownership.bind(sessionID: sessionID, uuid: uuid) == nil)
        #expect(ownership.provenance(sessionID: sessionID) == .external)
    }

    @Test
    func `a Session with no transcript id of its own is external rather than claimed`() {
        let (ownership, _) = registry()
        _ = ownership.claim(naming: uuid)

        // A spawn row has no file yet, so there is nothing to match on.
        #expect(ownership.bind(sessionID: sessionID, uuid: nil) == nil)
        #expect(ownership.provenance(sessionID: nil) == .external)
    }

    /// A resume knows the Session before the process exists, so it needs no transcript to appear
    /// first (#10).
    @Test
    func `a resume claims the Session it names from birth`() {
        let (ownership, clock) = registry()
        clock.nowMs = 5000
        let claim = ownership.claim(resuming: sessionID)

        #expect(ownership.provenance(sessionID: sessionID) == .managed)
        #expect(ownership.ownerOf(sessionID: sessionID) == claim)
    }

    /// One claim is one agent, so the second Session to answer to a claim's name is not its (#731).
    /// Reachable only by two spawns minting the same uuid, and the rule holds rather than races.
    @Test
    func `a bound claim adopts no second Session`() {
        let (ownership, clock) = registry()
        _ = ownership.claim(naming: uuid)
        ownership.bind(sessionID: sessionID, uuid: uuid)
        clock.nowMs = 3000

        let second = "/tmp/argo-elsewhere/11111111-2222-3333-4444-555555555555.jsonl"
        #expect(ownership.bind(sessionID: second, uuid: uuid) == nil)
        #expect(ownership.provenance(sessionID: second) == .external)
    }
}
