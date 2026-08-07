import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

@Suite("Cockpit presentation")
struct CockpitPresentationTests {
    @Test
    func `access is what provenance IS, never a literal beside it`() {
        // `allCases`, so a provenance added to the domain has to decide its access here.
        let access = SessionProvenance.allCases.map(CockpitPresentation.Session.Access.init)

        // Orphaned reads read-only too: the PTY died with the Argo that owned it.
        #expect(access == [.managed, .readOnly, .readOnly])
    }

    @Test
    @MainActor
    func `the Hub's own checkout and connection reach the shell unrenamed`() {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))

        let presentation = CockpitPresentation(hub: hub)

        #expect(presentation.project.location == "/tmp/project")
        #expect(presentation.checkout == CheckoutProjection.Head.unavailable)
        #expect(presentation.connection == HubConnection.healthy)
        #expect(presentation.sessions.isEmpty)
    }

    @Test
    @MainActor
    func `an observed Session projects as read-only, with the status its turns imply`(
    ) async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(hub, id: "observed", events: [
            .title("Refactor the auth module"),
            .cwd("/Users/milad/Developer/argo"),
            .model("claude-opus-5"),
            .branch("main"),
            .prompt(text: "Refactor it", atMs: nil),
            .turnEnded(.endTurn),
        ], until: { $0.status == .idle })

        let session = try #require(CockpitPresentation(hub: hub).sessions.first)

        #expect(session.title == "Refactor the auth module")
        #expect(session.model == "claude-opus-5")
        #expect(session.workspaceLocation == "/Users/milad/Developer/argo")
        #expect(session.access == .readOnly)
        #expect(session.status == .idle)
    }

    @Test
    @MainActor
    func `a Session with no turn boundary reads unknown, never idle`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(
            hub,
            id: "silent",
            events: [.cwd("/Users/milad/Developer/argo")],
            until: { $0.workspaceLocation != nil },
        )

        let session = try #require(CockpitPresentation(hub: hub).sessions.first)

        #expect(session.status == .unknown)
    }

    /// Drive a finite stream into the Hub and yield until the roster has read all of it.
    ///
    /// Yielding rather than awaiting the tail: the tail is the Hub's own task and nothing public
    /// hands it back, so the observable end is the roster the events land in.
    @MainActor
    private func observe(
        _ hub: Hub,
        id: String,
        events: [TranscriptEvent],
        until applied: (CockpitPresentation.Session) -> Bool,
    ) async {
        let stream = AsyncStream<TranscriptEvent> { continuation in
            for event in events {
                continuation.yield(event)
            }
            continuation.finish()
        }
        await hub.startObserving(TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: stream,
        ))
        for _ in 0 ..< 200 {
            if let session = CockpitPresentation(hub: hub).sessions.first, applied(session) {
                return
            }
            await Task.yield()
        }
    }
}
