@testable import ArgoEngine
import Foundation
import Testing

/// The standing stance as the record reports it. The fixture's shapes are verbatim from `claude`
/// 2.1.227 on 2026-08-11, including the `mode` record beside them — which carries `normal` and is a
/// different axis entirely, so reading it as a stance would put the wrong word on the footer.
@Suite("Mode reading")
struct ModeReadingTests {
    private func modes(_ events: [TranscriptEvent]) -> [String] {
        events.compactMap { event in
            guard case let .mode(cli) = event else { return nil }
            return cli
        }
    }

    @Test
    func `the CLI's own value is read verbatim, in the order the file stated it`() async throws {
        let read = try await modes(Fixture.events("permissionModes"))

        // Three and not two: the prompt between the records states the stance it was submitted
        // under, and is read as the same fact — see the walk fixture below.
        #expect(read == ["acceptEdits", "acceptEdits", "auto"])
    }

    /// A prompt states the stance it was submitted under, and that is the only timely reading of a
    /// walk (#629). Verbatim from `claude` 2.1.250 on 2026-08-28: the rung was walked to `auto`
    /// between the two prompts, and the CLI wrote NO `permission-mode` record for it until the
    /// process exited — so a reader watching only that record draws the old rung for a whole
    /// Session.
    @Test
    func `a prompt reports the stance it was submitted under`() async throws {
        let read = try await modes(Fixture.events("promptStance"))

        #expect(read == ["acceptEdits", "acceptEdits", "auto"])
    }

    /// A tool result is a `user` record that carries no stance, and it must contribute none:
    /// counted as a reading it would be a record speaking after a set, which is what tells a
    /// change that did not land from one that has not been reported yet.
    @Test
    func `a user record with no stance on it reports none`() async throws {
        let read = try await modes(Fixture.events("promptStance"))

        #expect(read.count == 3)
    }

    /// The value is passed through unread: what it MEANS is `ClaudePermissionMode`'s, so a value
    /// nothing recognises still reaches the ladder to be called unknown there.
    @Test
    func `a permission-mode record with no value says nothing rather than something empty`(
    ) async throws {
        #expect(try await !modes(Fixture.events("permissionModes")).contains(""))
    }

    /// The stance is the LATEST reading: a cycle mid-session leaves the earlier value in the file
    /// above the one that replaced it.
    @Test
    @MainActor
    func `a Session's stance is the last value its records reported`() async throws {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-mode"))
        let observed = hubTestObservation(id: "session", events: [
            .mode(cli: "acceptEdits"),
            .prompt(text: "cycle it", images: [], atMs: 1000),
            .mode(cli: "auto"),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.mode == .exactly(.auto, cli: "auto"))
    }

    /// The walk's own reading, read off the file rather than assembled by hand (#629): Argo set
    /// the rung, the CLI wrote no `permission-mode` record for it, and the next prompt is what
    /// says where the Session landed. Without the prompt read as a stance nothing confirms the
    /// walk until the process exits, which is the live failure this test stands in for.
    @Test
    @MainActor
    func `a walk is confirmed by the next prompt's own stance`() async throws {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-mode"))
        let events = try await Fixture.events("promptStance")
        let observed = hubTestObservation(id: "session", events: events)

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.mode == .exactly(.auto, cli: "auto"))
        #expect(session.modeDidNotTake == nil)
    }

    /// A Session nothing has said a stance about is `unknown` — never the baseline rung, which
    /// would
    /// be Argo stating its own default as an observation.
    @Test
    @MainActor
    func `a Session whose records reported no stance is unknown`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-mode"))
        let observed = hubTestObservation(id: "session", events: [
            .prompt(text: "say nothing about mode", images: [], atMs: 1000),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(hub.sessions.first?.mode == .unknown(cli: nil))
    }
}
