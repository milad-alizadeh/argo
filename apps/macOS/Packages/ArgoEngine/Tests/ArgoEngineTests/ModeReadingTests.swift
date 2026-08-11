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

        #expect(read == ["acceptEdits", "auto"])
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
            .prompt(text: "cycle it", atMs: 1000),
            .mode(cli: "auto"),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.mode == .exactly(.auto, cli: "auto"))
    }

    /// A Session nothing has said a stance about is `unknown` — never the baseline rung, which
    /// would
    /// be Argo stating its own default as an observation.
    @Test
    @MainActor
    func `a Session whose records reported no stance is unknown`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-mode"))
        let observed = hubTestObservation(id: "session", events: [
            .prompt(text: "say nothing about mode", atMs: 1000),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(hub.sessions.first?.mode == .unknown(cli: nil))
    }
}
