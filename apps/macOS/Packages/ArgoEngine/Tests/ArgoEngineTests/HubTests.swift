@testable import ArgoEngine
import Foundation
import Testing

@Suite("Hub")
struct HubTests {
    @Test
    @MainActor
    func `transcript facts become one Session projection`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        continuation.yield([
            .headLeaf(uuid: "leaf"),
            .prompt(text: "Build the native shell\nwith context", atMs: nil),
            .cwd("/tmp/argo"),
            .model("claude-opus-5"),
            .branch("argo/#376-native-shell"),
        ])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(hub.sessions.count == 1)
        #expect(hub.sessions[0].title == "Build the native shell")
        #expect(hub.sessions[0].cwd == "/tmp/argo")
        #expect(hub.sessions[0].model == "claude-opus-5")
        #expect(hub.sessions[0].branch == "argo/#376-native-shell")
        #expect(hub.sessions[0].headLeafUUID == "leaf")
    }

    @Test
    @MainActor
    func `the host title replaces the prompt fallback`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        continuation.yield([.prompt(text: "Fallback title", atMs: nil)])
        continuation.yield([.title("Host-authored title")])
        continuation.yield([.prompt(text: "Later prompt", atMs: nil)])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(hub.sessions[0].title == "Host-authored title")
    }

    @Test
    @MainActor
    func `an unreadable configured transcript becomes a failure`() async {
        let projectURL = URL(fileURLWithPath: "/tmp/argo")
        let transcriptURL = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString)
        let configuration = LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [transcriptURL],
        )
        let hub = Hub(projectURL: projectURL)

        await hub.connect(to: configuration)

        #expect(hub.connection == .failed(message: "Transcript unavailable"))
        #expect(hub.sessions.isEmpty)
    }

    @Test
    @MainActor
    func `resume files become one root-keyed Session`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let child = try await hubFixtureObservation("resumeChild")
        let parent = try await hubFixtureObservation("resumeParent")

        await hubObserveToEnd(hub, child)
        await hubObserveToEnd(hub, parent)

        #expect(hub.sessions.count == 1)
        #expect(hub.sessions[0].id == "resumeParent")
        #expect(hub.sessions[0].title == "Start the parent work")
        #expect(hub.sessions[0].branch == "main")
    }

    @Test
    @MainActor
    func `resume continuation owns the latest workspace facts`() async {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let child = hubTestObservation(id: "child", events: [
            .headLeaf(uuid: "parent-leaf"),
            .recordIdentity(uuid: "child-record"),
            .cwd("/tmp/new-worktree"),
            .branch("feature"),
        ])
        let parent = hubTestObservation(id: "parent", events: [
            .headLeaf(uuid: "parent-root"),
            .recordIdentity(uuid: "parent-root"),
            .recordIdentity(uuid: "parent-leaf"),
            .cwd("/tmp/original-worktree"),
            .branch("main"),
        ])

        await hubObserveToEnd(hub, child)
        await hubObserveToEnd(hub, parent)

        #expect(hub.sessions[0].cwd == "/tmp/new-worktree")
        #expect(hub.sessions[0].branch == "feature")
    }

    /// A refresh is a refresh OF something, and the Hub is the only thing that knows what: it was
    /// made pointed at one folder, pointed at another, and the checkout read then resolved that one
    /// to its repository root. All three used to be supplyable, and the caller picked.
    @Test
    @MainActor
    func `a refresh follows the Project the Hub is on`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let elsewhere = try fixture.folder("elsewhere", git: true)
        let repositoryURL = try fixture.folder("repository", git: true)
        let packageURL = try fixture.folder("repository/apps/macOS")
        let hub = Hub(projectURL: elsewhere)

        try await hub.connect(to: LaunchConfiguration(
            projectURL: packageURL,
            transcriptURLs: [hubFixtureURL("prose")],
        ))
        #expect(hub.project.url == repositoryURL)

        // The folder the Hub was POINTED with goes away; the repository it resolved to stays. A
        // refresh reading the configuration back would answer with a path that is no longer there.
        try fixture.remove(packageURL)
        await hub.refreshCheckout()

        // Not `elsewhere`, which is what it was made with, and not `packageURL`, which is what it
        // was pointed with — the refresh reads the one repository the Hub settled on.
        #expect(hub.project.url == repositoryURL)
        await hub.disconnect()
    }

    @Test
    func `a collection is fully validated before observation starts`() throws {
        let readableURL = try #require(
            Bundle.module.url(
                forResource: "externalBasic",
                withExtension: "jsonl",
                subdirectory: "Fixtures",
            ),
        )
        let unreadableURL = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString)

        #expect(throws: TranscriptObservationError.self) {
            try Engine().observeTranscripts(at: [readableURL, unreadableURL])
        }
    }

    @Test
    func `duplicate transcript arguments collapse before observation`() {
        let sourceURL = URL(fileURLWithPath: "/tmp/session.jsonl")

        let normalized = Engine().normalizedTranscriptURLs([sourceURL, sourceURL])

        #expect(normalized == [sourceURL.standardizedFileURL])
    }
}
