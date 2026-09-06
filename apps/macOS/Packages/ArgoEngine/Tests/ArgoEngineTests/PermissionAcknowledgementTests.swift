@testable import ArgoEngine
import Foundation
import Testing

/// The handshake that bounds the hook's wait (#1553).
///
/// A gate that cannot be dialled at all was always answered — `nc` fails, the script denies, and
/// `PermissionChannelTests.Relay` covers it. What had no answer was the case in the ticket: a gate
/// that ACCEPTS the dial, takes the payload, and then shows the request to nobody. The socket is
/// there, the hook is there, and the Session waits on a decision no surface is asking anyone for.
///
/// So the gate now says it is HOLDING the request the moment that request is on its pile and
/// published, and the hook's own patience runs until it hears that and no further. Both halves are
/// asserted here: the wait that must END, and the wait that must NOT.
///
/// Serialized with the rest of the socket suites: every case drives a `DispatchSource` on the main
/// queue and waits on the main actor for it to fire.
@Suite("Permission gate acknowledgement", .serialized)
@MainActor
struct PermissionAcknowledgementTests {
    /// One second, so the wait that must end is over inside a test rather than inside a working
    /// day. What the number MEANS is a local socket round trip, and the shipped default is on
    /// `PermissionPatience`.
    private static let ackSeconds = 1

    /// The ticket's own shape: the dial is heard, the payload is taken, and nothing is ever shown
    /// to anybody. Before the handshake this hook waited on `nc` with no clock of its own.
    @Test(.timeLimit(.minutes(1)))
    func `a gate that takes the question and shows it to nobody is denied, not waited on`()
        async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let silent = try Self.silentGate(in: fixture)
        defer { silent.close() }

        let hook = try RelayHook.launched(script: Self.hookDialling(silent.path, in: fixture))
        defer { hook.end() }

        await settle { !hook.process.isRunning }
        let told = try hook.printed(allowingUnreachableGate: true)
        let line = told.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        // PARSED, not searched, for the reason the fail-closed test beside it parses: a CLI that
        // cannot read what a hook said reads it as a hook with no opinion, and runs the call.
        let decision = try #require(JSONValue.record(fromLine: line)?["hookSpecificOutput"])
        #expect(decision.stringField("permissionDecision") == "deny")
        #expect(decision.stringField("permissionDecisionReason") == gateTookNothingReason)
    }

    /// The failure this whole script exists to make impossible, reached the one way the bounded
    /// wait opened up: a gate that writes PART of a decision and then dies.
    ///
    /// `CompanionConnection` writes to a non-blocking socket, so a reply can sit half-written in
    /// its outbox; an app that goes between flushes leaves the hook holding a prefix. Printed
    /// verbatim, that prefix is JSON the CLI cannot read — which it takes as a hook with no
    /// opinion, and it RUNS the call nobody allowed. So nothing is printed that did not arrive as
    /// a whole line, and a prefix denies like any other silence.
    @Test(.timeLimit(.minutes(1)))
    func `a decision cut off mid-line is denied, never handed to the CLI`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let socketPath = fixture.companionRoot.appending(path: "cut.gate.sock").path
        let server = try await Self.serving(Self.severedDecision, at: socketPath)
        defer { server.end() }

        let hook = try RelayHook.launched(script: Self.hookDialling(socketPath, in: fixture))
        defer { hook.end() }

        await settle { !hook.process.isRunning }
        let told = try hook.printed(allowingUnreachableGate: true)
        #expect(!told.contains(Self.severedDecision), "\(told)")
        let line = told.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let decision = try #require(JSONValue.record(fromLine: line)?["hookSpecificOutput"])
        #expect(decision.stringField("permissionDecision") == "deny")
    }

    /// The other half, and the one that keeps the fix from being a regression: a gate that DID say
    /// it is holding the request may take as long as a person takes. The acknowledgement window is
    /// one second here and the answer arrives well after it, so a hook that read its own clock as
    /// the decision's would have denied a call somebody allowed.
    @Test(.timeLimit(.minutes(1)))
    func `a gate that says it is holding the request may answer long after that window`()
        async throws {
        try await PermissionGate.withGate(patience: Self.patience) { fixture, claim, _ in
            let hook = try RelayHook.launched(fixture, claim)
            defer { hook.end() }
            try await hook.waitForPrompt(in: fixture)

            // Past the acknowledgement window, several times over, with nobody having answered.
            try await Task.sleep(for: .seconds(Self.ackSeconds * 3))
            let waiting = try #require(fixture.hub.sessions.first?.permission)
            #expect(hook.process.isRunning)

            try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)
            await settle { !hook.process.isRunning }

            let told = try hook.printed()
            let line = told.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
            let decision = try #require(JSONValue.record(fromLine: line)?["hookSpecificOutput"])
            #expect(decision.stringField("permissionDecision") == "allow")
            // The notice is the hook's own business and never the CLI's: a line the CLI cannot
            // parse is a hook with no opinion, and it would run the call it just asked about.
            #expect(!told.contains(GateNotice.held), "\(told)")
        }
    }

    /// A call the gate answers on the spot — the top rung waves this one through — says its
    /// decision in ONE line and no notice at all. The hook must read that line as the decision
    /// rather than waiting for a second that is never coming.
    @Test(.timeLimit(.minutes(1)))
    func `a call the gate answers at once is not left waiting for a second line`() async throws {
        try await PermissionGate.withGate(on: .auto, patience: Self.patience) { fixture, claim, _ in
            let hook = try RelayHook.launched(fixture, claim)
            defer { hook.end() }

            await settle { !hook.process.isRunning }
            let told = try hook.printed()
            let line = told.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
            let decision = try #require(JSONValue.record(fromLine: line)?["hookSpecificOutput"])
            #expect(decision.stringField("permissionDecision") == "allow")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    /// A day for the person, a second for the round trip — the two numbers the gate hands its hook.
    private static let patience = PermissionPatience(
        seconds: PermissionPatience.default.seconds,
        acknowledgementSeconds: ackSeconds,
    )

    /// An ALLOW with its tail cut off, and the word `allow` is what makes it usable as evidence:
    /// cut any earlier and the fragment is a prefix of the denial this hook prints on its way out,
    /// so a passing hook would look like a leaking one. No trailing newline, which is the whole of
    /// what makes it a fragment.
    private static let severedDecision =
        #"{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","perm"#

    /// A listener that writes exactly those bytes to the first dial and then hangs up. `nc -lU`
    /// rather than a `CompanionSocket`, because what is under test is a reply that never finished
    /// a line, and the socket type this app ships cannot write one.
    private static func serving(_ bytes: String, at path: String) async throws
        -> RelayHook {
        let server = RelayHook()
        server.process.executableURL = URL(fileURLWithPath: "/bin/sh")
        server.process.arguments = [
            "-c", "printf '%s' '\(bytes)' | /usr/bin/nc -lU '\(path)'",
        ]
        try server.process.run()
        // The dial has to find a socket to refuse or to answer; without this wait the hook can
        // reach the path before `nc` has bound it, and the test would be about a missing file.
        while !FileManager.default.fileExists(atPath: path) {
            try await Task.sleep(for: .milliseconds(20))
        }
        return server
    }

    /// A socket bound at a path of this fixture's own that accepts every dial, reads every line,
    /// and answers nothing. Standing in for a gate that took the request and never showed it.
    private static func silentGate(in fixture: SpawnFixture) throws -> CompanionSocket {
        let socket = CompanionSocket(
            path: fixture.companionRoot.appending(path: "silent.gate.sock").path,
        ) { _ in nil }
        try socket.open()
        return socket
    }

    /// The SHIPPED hook, written out against that socket. Materialized rather than hand-written:
    /// what is under test is the script this build installs, and a copy in a string would pass
    /// while the shipped one hangs.
    private static func hookDialling(_ socketPath: String, in fixture: SpawnFixture) throws -> URL {
        let claim = SessionOwnership.ClaimID(value: "silent")
        _ = try CompanionPlugin.materialize(
            forClaim: claim,
            under: fixture.companionRoot,
            socketPath: fixture.companionRoot.appending(path: "silent.sock").path,
            gatedBy: PermissionGrant(
                socketPath: socketPath,
                acknowledgementSeconds: ackSeconds,
            ),
        )
        return fixture.companionRoot.appending(path: claim.value)
            .appending(path: "permission-hook.sh")
    }
}
