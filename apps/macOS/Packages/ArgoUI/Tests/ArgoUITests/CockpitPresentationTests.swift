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
        let registered = CockpitPresentation.Project(
            id: "argo",
            name: "argo",
            location: "/tmp/project",
        )

        let presentation = projection(of: hub, projects: [registered])

        #expect(presentation.activeProject?.id == registered.id)
        #expect(presentation.checkout == CheckoutProjection.Head.unavailable)
        // A Hub with nothing to read is not a connected one, and the shell is told which.
        #expect(presentation.connection == HubConnection.idle)
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

        let session = try #require(projection(of: hub).sessions.first)

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

        let session = try #require(projection(of: hub).sessions.first)

        #expect(session.status == .unknown)
    }

    @Test
    @MainActor
    func `the Session's own stream reaches the shell, in order and unedited`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(hub, id: "spoken", events: [
            .prompt(text: "  Read it  ", atMs: 1000),
            .thought(markdown: "Start at the contract."),
            .message(markdown: "Reading."),
        ], until: { !$0.events.isEmpty })

        let session = try #require(projection(of: hub).sessions.first)

        // Verbatim to the shell: the prompt's own whitespace survives the crossing, because the
        // presentation is a hand-over and not a reading.
        #expect(session.events == [
            .prompt(text: "  Read it  ", atMs: 1000),
            .thought(markdown: "Start at the contract."),
            .message(markdown: "Reading."),
        ])
    }

    @Test
    func `a selection that no longer names a Session resolves to nothing`() {
        let presentation = CockpitPresentation.preview

        #expect(presentation.session("shell")?.id == "shell")
        #expect(presentation.session("a session that ended") == nil)
        #expect(presentation.session(nil) == nil)
    }

    /// The Hub half of the projection, which is the half with a derivation in it. The Projects are
    /// the app's own state and are passed straight through.
    @MainActor
    private func projection(
        of hub: Hub,
        projects: [CockpitPresentation.Project] = [],
    )
        -> CockpitPresentation {
        CockpitPresentation(projects: projects, activeProjectID: projects.first?.id, hub: hub)
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
        // One batch, which is how a tail hands over a file it has finished reading.
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield(events)
            continuation.finish()
        }
        await hub.startObserving(TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: stream,
        ))
        for _ in 0 ..< 200 {
            if let session = projection(of: hub).sessions.first, applied(session) {
                return
            }
            await Task.yield()
        }
    }
}
