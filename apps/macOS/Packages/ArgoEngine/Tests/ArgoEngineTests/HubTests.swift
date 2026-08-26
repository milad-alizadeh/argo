@testable import ArgoEngine
import Foundation
import Testing

@Suite("Hub")
struct HubTests {
    @Test
    @MainActor
    func `transcript facts become one Session projection`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        continuation.yield([
            .headLeaf(uuid: "leaf"),
            .prompt(text: "Build the native shell\nwith context", images: [], atMs: nil),
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
    func `a detached checkout carries no branch rather than the word HEAD`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        continuation.yield([.branch("HEAD")])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        // What the CLI writes for a checkout that is on no branch. Rendered as-is it is a branch
        // name nobody can check out — the degrade-down rule says an unestablishable fact is
        // absent, never the nearest word (`CONTEXT.md`, Honesty tier).
        #expect(hub.sessions[0].branch == nil)
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
        let hub = testHub(projectURL: projectURL)

        await hub.connect(to: configuration)

        #expect(hub.connection == .failed(message: "Transcript unavailable"))
        #expect(hub.sessions.isEmpty)
    }

    @Test
    @MainActor
    func `resume files become one root-keyed Session`() async throws {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
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
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
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

    /// Three URLs are in play: the one the Hub was made with, the one it was pointed at, and the
    /// repository root the checkout read resolved that to. A refresh follows the last.
    @Test
    @MainActor
    func `a refresh follows the Project the Hub is on`() async throws {
        let elsewhere = URL(fileURLWithPath: "/tmp/argo-elsewhere")
        let repositoryURL = URL(fileURLWithPath: "/tmp/argo-repository")
        let packageURL = repositoryURL.appending(path: "apps/macOS", directoryHint: .isDirectory)
        let checkout = CheckoutFixture()
        await checkout.repository(at: elsewhere)
        await checkout.repository(at: repositoryURL, head: .branch("main"), folders: [packageURL])
        let hub = testHub(projectURL: elsewhere, checkout: checkout.read)

        try await hub.connect(to: LaunchConfiguration(
            projectURL: packageURL,
            transcriptURLs: [hubFixtureURL("prose")],
        ))
        #expect(hub.project.url == repositoryURL)

        // The folder the Hub was POINTED with goes away; the repository it resolved to stays. A
        // refresh reading the configuration back would answer with a path that is no longer there.
        await checkout.forget(packageURL)
        await hub.refreshCheckout()

        #expect(hub.project.url == repositoryURL)
        await hub.disconnect()
    }

    /// Every head a repository can be on reaches the projection the shell renders.
    @Test(arguments: [CheckoutProjection.Head.branch("main"), .detached(shortSHA: "95a8d79")])
    @MainActor
    func `the head the checkout read answers with is the head of the Project`(
        head: CheckoutProjection.Head,
    ) async throws {
        let repositoryURL = URL(fileURLWithPath: "/tmp/argo-repository")
        let checkout = CheckoutFixture()
        await checkout.repository(at: repositoryURL, head: head)
        let hub = testHub(projectURL: repositoryURL, checkout: checkout.read)

        try await hub.connect(to: LaunchConfiguration(
            projectURL: repositoryURL,
            transcriptURLs: [hubFixtureURL("prose")],
        ))

        #expect(hub.checkout == head)
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
