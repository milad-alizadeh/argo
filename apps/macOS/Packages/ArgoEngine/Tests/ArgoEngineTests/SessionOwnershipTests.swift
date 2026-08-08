@testable import ArgoEngine
import Testing

/// The `managed | external` axis as a read rather than a literal — which is what stops the roster's
/// read-only lock from being a decision made in the view.
@Suite("Session ownership")
@MainActor
struct SessionOwnershipTests {
    private let cwd = "/tmp/argo-owned"

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

        #expect(ownership.provenance(cwd: cwd, startedAtMs: 2000) == .external)
    }

    @Test
    func `a Session started inside a live claim is managed`() {
        let (ownership, clock) = registry()
        _ = ownership.claim(cwd: cwd)
        clock.nowMs = 2000

        #expect(ownership.provenance(cwd: cwd, startedAtMs: clock.nowMs) == .managed)
    }

    @Test
    func `a claim whose PTY has exited leaves the Session orphaned`() {
        let (ownership, clock) = registry()
        let claim = ownership.claim(cwd: cwd)
        clock.nowMs = 2000
        ownership.release(claim)
        clock.nowMs = 3000

        // Observation survives the PTY; steering does not — and neither does `managed`.
        #expect(ownership.provenance(cwd: cwd, startedAtMs: 2000) == .orphaned)
    }

    @Test
    func `an agent already running in a folder Argo later spawns into stays external`() {
        let (ownership, clock) = registry()
        clock.nowMs = 5000
        _ = ownership.claim(cwd: cwd)

        // Started before the claim opened, so no claim covers it: the folder alone is not a key.
        #expect(ownership.provenance(cwd: cwd, startedAtMs: 4000) == .external)
    }

    @Test
    func `a claim covers only the folder it was made in`() {
        let (ownership, _) = registry()
        _ = ownership.claim(cwd: cwd)

        #expect(ownership.provenance(cwd: "/tmp/argo-elsewhere", startedAtMs: 2000) == .external)
    }

    @Test
    func `a Session Argo cannot place is external rather than claimed`() {
        let (ownership, _) = registry()
        _ = ownership.claim(cwd: cwd)

        // No working directory read, or no time in its records: an unprovable claim is not a claim.
        #expect(ownership.provenance(cwd: nil, startedAtMs: 2000) == .external)
        #expect(ownership.provenance(cwd: cwd, startedAtMs: nil) == .external)
    }
}
