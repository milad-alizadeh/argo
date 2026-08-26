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

    /// The grading of one Session in this suite's folder. Named even where the test is about the
    /// folder window, because the id is what the durable half is keyed by.
    private func grading(_ ownership: SessionOwnership, startedAtMs: Int?) -> SessionProvenance {
        ownership.provenance(sessionID: "session-a", cwd: cwd, startedAtMs: startedAtMs)
    }

    @Test
    func `a Session nothing claimed is external`() {
        let (ownership, _) = registry()

        #expect(grading(ownership, startedAtMs: 2000) == .external)
    }

    @Test
    func `a Session started inside a live claim is managed`() {
        let (ownership, clock) = registry()
        _ = ownership.claim(cwd: cwd)
        clock.nowMs = 2000

        #expect(grading(ownership, startedAtMs: clock.nowMs) == .managed)
    }

    @Test
    func `a claim whose PTY has exited leaves the Session orphaned`() {
        let (ownership, clock) = registry()
        let claim = ownership.claim(cwd: cwd)
        clock.nowMs = 2000
        ownership.release(claim)
        clock.nowMs = 3000

        // Observation survives the PTY; steering does not — until the chain is resumed (#10).
        #expect(grading(ownership, startedAtMs: 2000) == .orphaned)
    }

    @Test
    func `an agent already running in a folder Argo later spawns into stays external`() {
        let (ownership, clock) = registry()
        clock.nowMs = 5000
        _ = ownership.claim(cwd: cwd)

        // Started before the claim opened, so no claim covers it: the folder alone is not a key.
        #expect(grading(ownership, startedAtMs: 4000) == .external)
    }

    @Test
    func `a claim covers only the folder it was made in`() {
        let (ownership, _) = registry()
        _ = ownership.claim(cwd: cwd)

        let elsewhere = ownership.provenance(
            sessionID: "session-a",
            cwd: "/tmp/argo-elsewhere",
            startedAtMs: 2000,
        )
        #expect(elsewhere == .external)
    }

    @Test
    func `a Session Argo cannot place is external rather than claimed`() {
        let (ownership, _) = registry()
        _ = ownership.claim(cwd: cwd)

        // No working directory read, or no time in its records: an unprovable claim is not a claim.
        #expect(ownership.provenance(sessionID: "s", cwd: nil, startedAtMs: 2000) == .external)
        #expect(grading(ownership, startedAtMs: nil) == .external)
    }

    /// A resume knows the Session before the process exists, so it needs neither half of the key a
    /// cold spawn is matched back by (#10).
    @Test
    func `a resume claims the Session it names, whatever the window says`() {
        let (ownership, clock) = registry()
        clock.nowMs = 5000
        let claim = ownership.claim(cwd: cwd, resuming: "session-a")

        // The chain started long before the claim did, and it is managed all the same.
        #expect(grading(ownership, startedAtMs: 100) == .managed)
        #expect(ownership.ownerOf(sessionID: "session-a") == claim)
    }

    /// A resume claim already names its Session, so the window it happens to span is nobody else's
    /// (#731). Without this an unrelated agent started in the same folder grades `managed`, and the
    /// cockpit offers it a composer wired to the resumed agent's PTY.
    @Test
    func `a claim that already has its Session adopts no other`() {
        let (ownership, clock) = registry()
        clock.nowMs = 5000
        _ = ownership.claim(cwd: cwd, resuming: "session-a")
        clock.nowMs = 6000

        let elsewhere = ownership.provenance(
            sessionID: "session-b",
            cwd: cwd,
            startedAtMs: clock.nowMs,
        )
        #expect(elsewhere == .external)
    }

    /// The same rule for a cold claim, once the record it was matched back to has appeared: one
    /// claim is one agent, so the second Session in the window belongs to whoever started it.
    @Test
    func `a bound claim adopts no second Session`() {
        let (ownership, clock) = registry()
        _ = ownership.claim(cwd: cwd)
        clock.nowMs = 2000
        ownership.bind(sessionID: "session-a", cwd: cwd, startedAtMs: clock.nowMs)
        clock.nowMs = 3000

        #expect(grading(ownership, startedAtMs: 2000) == .managed)
        let second = ownership.provenance(sessionID: "session-b", cwd: cwd, startedAtMs: 3000)
        #expect(second == .external)
    }
}
