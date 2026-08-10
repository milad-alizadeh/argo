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

        // One posture each, in provenance's own order. Orphaned is read-only too — the PTY died
        // with the Argo that owned it — but it is not `external`, and the header says which.
        #expect(access == [.managed, .external, .orphaned])
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
        #expect(session.access == .external)
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

    @Test
    @MainActor
    func `the branch reaches the shell on a Workspace, with the CLI beside it`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(hub, id: "branched", events: [
            .cwd("/Users/milad/Developer/argo"),
            .branch("argo/#510-session-header-facts"),
            .prompt(text: "Draw the header", atMs: nil),
            .turnEnded(.endTurn),
        ], until: { $0.status == .idle })

        let session = try #require(projection(of: hub).sessions.first)

        // The join key lives on the Workspace (`CONTEXT.md` L3), and the CLI is the record store
        // the transcript was swept out of rather than a guess at the prose inside it.
        #expect(session.workspace?.branch == "argo/#510-session-header-facts")
        #expect(session.cli == .claude)
        // Nothing has read git for this folder, so its state is ABSENT rather than clean: the
        // header draws no marks at all, which is a different claim from `0`.
        #expect(session.workspace?.kind == nil)
        #expect(session.workspace?.dirty == nil)
        #expect(session.workspace?.unpushed == nil)
    }

    /// The chain crosses the seam. It is the one Session fact that is Argo's own memory rather than
    /// a reading of a record, so a projection that dropped it would leave the link drawable only
    /// from a fixture.
    @Test
    @MainActor
    func `a handed-off Session names its successor on the way to the shell`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(hub, id: "full", events: [
            .cwd("/Users/milad/Developer/argo"),
            .prompt(text: "A long conversation", atMs: nil),
            .turnEnded(.endTurn),
        ], until: { $0.status == .idle })

        #expect(try #require(projection(of: hub).sessions.first).handedOffTo == nil)
        hub.handedOff(sessionID: "full", to: "fresh")

        #expect(try #require(projection(of: hub).sessions.first).handedOffTo == "fresh")
    }

    @Test
    @MainActor
    func `an archived Session reaches the shell archived, however busy its record is`(
    ) async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(hub, id: "cleared", events: [
            .cwd("/Users/milad/Developer/argo"),
            .prompt(text: "Keep going", atMs: nil),
        ], until: { !$0.events.isEmpty })
        // Through the real store, in a throwaway location: the flag the shell reads is the one
        // that was written to disk, not a value assembled beside it.
        let fileURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-\(UUID().uuidString)/sessions.json")
        defer { try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent()) }
        let store = SessionAnnotationStore(fileURL: fileURL)
        await store.setArchived(true, sessionID: "cleared")
        let annotations = await store.load()

        let session = try #require(projection(of: hub, annotations: annotations).sessions.first)

        // Read by chain id off Argo's own record, never off the transcript — which is why a
        // Session whose file just grew is still archived (#502, story 16).
        #expect(session.isArchived)
    }

    @Test
    @MainActor
    func `a Session nobody archived reaches the shell on the roster`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(hub, id: "kept", events: [.cwd("/Users/milad/Developer/argo")], until: {
            $0.workspaceLocation != nil
        })

        let session = try #require(projection(of: hub).sessions.first)

        #expect(session.isArchived == false)
    }

    /// The Hub half of the projection, which is the half with a derivation in it. The Projects are
    /// the app's own state and are passed straight through.
    @MainActor
    private func projection(
        of hub: Hub,
        projects: [CockpitPresentation.Project] = [],
        annotations: SessionAnnotations = .empty,
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: projects,
            activeProjectID: projects.first?.id,
            hub: hub,
            annotations: annotations,
        )
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
