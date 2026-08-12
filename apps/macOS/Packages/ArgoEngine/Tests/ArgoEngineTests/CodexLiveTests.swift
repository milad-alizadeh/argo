@testable import ArgoEngine
import Foundation
import Testing

/// The Codex adapter against a real `codex app-server` (#548, ADR-0024).
///
/// Off unless asked for by name, because these spend the user's tokens and take as long as an agent
/// takes: `ARGO_LIVE_CLI=1 swift test --filter CodexLiveTests`. They are the only tests that can
/// prove the shapes are the server's rather than the fake's, which is why the fake exists beside
/// them rather than instead of them.
///
/// Verified against `CodexClient.verifiedAgainst`. app-server is experimental, so a failure here on
/// a newer Codex is a protocol change to read rather than a bug to hunt.
@Suite("Codex live", .enabled(if: LiveCodex.isEnabled))
@MainActor
struct CodexLiveTests {
    /// The pin, checked. `app-server` is experimental and its shapes are observed rather than
    /// specified (ADR-0024), so a Codex upgrade has to fail a test rather than drift silently past
    /// the transcripts the adapter was written from.
    @Test
    func `the machine is on the Codex the adapter is verified against`() throws {
        #expect(try LiveCodex.installedVersion() == CodexClient.verifiedAgainst)
    }

    @Test(.timeLimit(.minutes(3)))
    func `a Turn sent from the port reaches a real Codex and does the work`() async throws {
        var live = try LiveCodex()
        defer { live.remove() }
        let session = try await live.spawn()

        try live.hub.driver.send(
            "Create a file named live.txt in the working directory containing exactly: alive. "
                + "Then stop.",
            to: session,
        )

        #expect(await live.settle(until: { live.hasFile("live.txt") }))
    }

    /// The `localImage` input item is the server's own shape or it is nothing: a `turn/start` it
    /// cannot read comes back a JSON-RPC error and no Turn ever starts. That the MODEL saw the
    /// picture is not asserted here — what a real Codex accepts on the wire is.
    @Test(.timeLimit(.minutes(3)))
    func `an attached image is accepted by a real Codex as an input item`() async throws {
        var live = try LiveCodex()
        defer { live.remove() }
        let session = try await live.spawn()
        let picture = try live.writeImage(named: "shot.png")

        try live.hub.driver.send(
            "Reply with the single word: seen",
            attaching: [.file(at: picture)],
            to: session,
        )

        #expect(await live.settle(until: { live.thread?.turnID != nil }))
        #expect(await live.settle(until: { live.thread?.turnID == nil }))
    }

    /// The interrupt is observed the way the cockpit observes it: the Turn the thread was running
    /// is over, and the thread is still there.
    @Test(.timeLimit(.minutes(3)))
    func `an interrupt ends the running Turn and leaves the thread usable`() async throws {
        var live = try LiveCodex()
        defer { live.remove() }
        let session = try await live.spawn()

        try live.hub.driver.send(
            "Count slowly from 1 to 200, writing one number per line as your answer.",
            to: session,
        )
        #expect(await live.settle(until: { live.thread?.turnID != nil }))
        let stopped = live.thread?.turnID

        try live.hub.driver.interrupt(session)

        #expect(await live.settle(until: { live.thread?.turnID == nil }))
        // Still steerable afterwards: an interrupt stops a Turn, never the Session (#541). Asserted
        // by a SECOND Turn actually starting, because a `send` onto a dead thread would refuse
        // rather than fail quietly, and a thread that took the line and did nothing would too.
        try live.hub.driver.send("Reply with the single word: alive", to: session)
        #expect(await live.settle(until: { live.thread?.turnID != nil }))
        #expect(live.thread?.turnID != stopped)
    }
}
