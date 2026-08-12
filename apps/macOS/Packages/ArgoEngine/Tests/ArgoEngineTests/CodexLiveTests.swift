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

    /// The approval round trip against the real server (#549): it asks, the cockpit raises it, the
    /// answer goes back as a JSON-RPC response, and the work happens.
    ///
    /// Opened on Read Only so the boundary is one the agent must ask to cross — writing anything is
    /// outside a read-only sandbox, which is what makes the server raise an approval rather than
    /// getting on with it. This constant is only as true as this run: `app-server` is experimental,
    /// and an approval that stopped arriving would leave the adapter silently un-gated.
    @Test(.timeLimit(.minutes(3)))
    func `a real Codex asks for approval, and an allow lets the work through`() async throws {
        var live = try LiveCodex()
        defer { live.remove() }
        let session = try await live.spawn(mode: .readOnly)

        try live.hub.driver.send(
            "Create a file named approved.txt in the working directory containing exactly: "
                + "alive. Then stop.",
            to: session,
        )
        #expect(await live.settle(until: { live.hub.sessions.first?.permission != nil }))
        let raised = try #require(live.hub.sessions.first?.permission)

        try live.hub.driver.decide(.allow, answering: raised.id, for: session)

        #expect(await live.settle(until: { live.hasFile("approved.txt") }))
        #expect(await live.settle(until: { live.hub.sessions.first?.permission == nil }))
    }

    /// The status half of the same round trip (#683). A real server raises `waitingOnApproval`
    /// while it holds the request and clears it on the answer — which is the only place that
    /// ordering can be established: the status and the approval are separate lines.
    @Test(.timeLimit(.minutes(3)))
    func `a real Codex reports waiting on an approval, and clears it on the answer`() async throws {
        var live = try LiveCodex()
        defer { live.remove() }
        let session = try await live.spawn(mode: .readOnly)

        try live.hub.driver.send(
            "Create a file named flagged.txt in the working directory. Then stop.",
            to: session,
        )
        #expect(await live.settle(until: {
            live.thread?.reported == .active([.waitingOnApproval])
        }))
        let raised = try #require(live.hub.sessions.first?.permission)

        try live.hub.driver.decide(.deny, answering: raised.id, for: session)

        #expect(await live.settle(until: {
            live.thread?.reported != .active([.waitingOnApproval])
        }))
    }

    /// The patch approval's own params carry no diff, so what the prompt names has to come off the
    /// item's notifications, joined on `itemId`. Whether those arrive BEFORE the approval is an
    /// ordering only the real server can settle — the spike recorded `turn/diff/updated`, which
    /// lands after the answer and would be too late.
    @Test(.timeLimit(.minutes(3)))
    func `a real Codex patch approval names the file it would write`() async throws {
        var live = try LiveCodex()
        defer { live.remove() }
        let session = try await live.spawn(mode: .readOnly)

        try live.hub.driver.send(
            "Create a file named patched.txt containing the single line: hello from patch. "
                + "Use apply_patch, not a shell command. Then stop.",
            to: session,
        )
        #expect(await live.settle(until: { live.hub.sessions.first?.permission != nil }))

        let raised = try #require(live.hub.sessions.first?.permission)
        guard case let .edit(path, hunks) = raised.target else {
            Issue.record("the patch prompt named no file: \(raised.target)")
            return
        }
        #expect(path.hasSuffix("patched.txt"))
        #expect(!hunks.isEmpty)
    }

    /// The other half, and the one the spike had to prove separately: a decline refuses that ONE
    /// action and the thread stays usable. That is what makes Argo's deny-on-timeout safe to
    /// impose — an expiry is this same `decline`, sent late.
    ///
    /// The Turn is not waited on and must not be: a refused agent commonly asks a SECOND time, so
    /// whether this Turn ends depends on what the model tries next. What is Argo's to assert is
    /// that the prompt went, the file was never written, and the Session still takes a Turn.
    @Test(.timeLimit(.minutes(3)))
    func `a deny refuses the action and leaves the Session usable`() async throws {
        var live = try LiveCodex()
        defer { live.remove() }
        let session = try await live.spawn(mode: .readOnly)

        try live.hub.driver.send(
            "Create a file named denied.txt in the working directory. Then stop.",
            to: session,
        )
        #expect(await live.settle(until: { live.hub.sessions.first?.permission != nil }))
        let raised = try #require(live.hub.sessions.first?.permission)

        try live.hub.driver.decide(.deny, answering: raised.id, for: session)

        #expect(await live.settle(until: { live.hub.sessions.first?.permission == nil }))
        #expect(!live.hasFile("denied.txt"))
        try live.hub.driver.interrupt(session)
        #expect(await live.settle(until: { live.thread?.turnID == nil }))
        try live.hub.driver.send("Reply with the single word: alive", to: session)
        #expect(await live.settle(until: { live.thread?.turnID != nil }))
    }
}
