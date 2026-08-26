@testable import ArgoEngine
import Foundation
import Testing

/// The claims the session-drive port makes, run against EVERY adapter (#535's testing decisions,
/// #548).
///
/// One suite rather than one per adapter, because "the composer drives a Session" must mean the
/// same thing on each: an adapter that quietly refused multi-line text, or accepted a Turn for a
/// Session whose process had gone, would be a difference the cockpit has no way to render. What
/// differs below the seam — keystrokes against JSON-RPC — is read through `DrivenSession`, which is
/// the only thing here that knows which CLI it is talking to.
@Suite("Session drive conformance")
@MainActor
struct SessionDriverConformanceTests {
    @Test(arguments: DrivenCLI.allCases)
    func `a Turn typed at the composer arrives once and whole`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)

        try fixture.hub.driver.send("Fix the caption, not the sort.", to: session.id)

        #expect(session.turns() == ["Fix the caption, not the sort."])
    }

    /// The whole multi-line story: a newline is not a submit, and what the user wrote is what the
    /// agent gets.
    @Test(arguments: DrivenCLI.allCases)
    func `multi-line text is one Turn, verbatim`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)
        let typed = "Fix the caption\n\nthen run `git commit -m \"done\"` — do not push"

        try fixture.hub.driver.send(typed, to: session.id)

        #expect(session.turns() == [typed])
    }

    @Test(arguments: DrivenCLI.allCases)
    func `a very long Turn arrives intact`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)
        let stackTrace = String(repeating: "at Argo.Hub.spawn(Hub.swift:42)\n", count: 500)

        try fixture.hub.driver.send(stackTrace, to: session.id)

        #expect(session.turns() == [stackTrace])
    }

    /// Return on an empty field would submit an empty Turn to a live agent.
    @Test(arguments: DrivenCLI.allCases)
    func `whitespace alone is not a Turn`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)

        #expect(throws: SessionDriveError.nothingToSend) {
            try fixture.hub.driver.send("  \n\t ", to: session.id)
        }
        #expect(session.turns().isEmpty)
    }

    @Test(arguments: DrivenCLI.allCases)
    func `a Session Argo never spawned refuses the Turn`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.drive(cli)

        #expect(throws: SessionDriveError.notDrivable) {
            try fixture.hub.driver.send("Are you there", to: "a-session-somebody-else-started")
        }
    }

    @Test(arguments: DrivenCLI.allCases)
    func `an orphaned Session refuses the Turn its live self would have taken`(
        cli: DrivenCLI,
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)
        session.end()

        #expect(throws: SessionDriveError.notDrivable) {
            try fixture.hub.driver.send("Carry on", to: session.id)
        }
    }

    /// Stopping a Session that is running nothing is silence: whether a Turn is in flight is a
    /// DERIVED reading, and the moment between reading it and clicking is where a Turn ends by
    /// itself.
    @Test(arguments: DrivenCLI.allCases)
    func `an interrupt is accepted whether or not a Turn is running`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)

        try fixture.hub.driver.interrupt(session.id)
    }

    @Test(arguments: DrivenCLI.allCases)
    func `an interrupt on an orphaned Session is refused`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)
        session.end()

        #expect(throws: SessionDriveError.notDrivable) {
            try fixture.hub.driver.interrupt(session.id)
        }
    }

    /// The channel half of the seam (#749): a spawn's channel is open before `spawnSession` has
    /// returned, so the first Turn reaches the agent rather than a channel nobody asked for yet.
    ///
    /// One claim on both surfaces, arrived at unlike ways — the PTY is `claude`'s whole channel,
    /// while `codex` is a thread that has to be asked for over a protocol — which is exactly why
    /// the Hub must not be the one deciding which.
    @Test(arguments: DrivenCLI.allCases)
    func `a spawn's channel is open before the spawn returns`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)

        try fixture.hub.driver.send("The first thing anybody said", to: session.id)

        #expect(session.turns() == ["The first thing anybody said"])
    }

    /// And the other direction: a claim's output goes to ONE channel, and the port is what says
    /// which. What the wrong channel would do with it is not harmless — a Codex Session's JSON-RPC
    /// held in a terminal replay buffer is a protocol stream kept for a viewer that cannot exist.
    @Test(arguments: DrivenCLI.allCases)
    func `a Session's own output reaches its own channel`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)

        #expect(session.heard())
    }

    /// A claim given up closes every channel it spoke over, and the Turn that follows is refused on
    /// the same fact — which is what keeps a channel from outliving the process behind it.
    @Test(arguments: DrivenCLI.allCases)
    func `a Session's output goes nowhere once its claim is given up`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)
        session.end()

        #expect(!session.heard())
    }

    /// Both adapters take attachments, by unlike means, and both name every one of them in the
    /// Turn's own words so the record says what the agent was given.
    @Test(arguments: DrivenCLI.allCases)
    func `a Turn names the attachment it carries`(cli: DrivenCLI) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.drive(cli)
        let shot = SessionAttachment.pastedImage(Data([0x89, 0x50]), fileExtension: "png")

        try fixture.hub.driver.send("What is wrong here?", attaching: [shot], to: session.id)

        let turn = try #require(session.turns().first)
        #expect(turn.hasPrefix("What is wrong here?"))
        #expect(turn.hasSuffix(".png"))
    }
}
