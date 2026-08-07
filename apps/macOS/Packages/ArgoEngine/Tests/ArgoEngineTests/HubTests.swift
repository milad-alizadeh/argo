@testable import ArgoEngine
import Foundation
import Testing

@Suite("Hub")
struct HubTests {
    @Test
    @MainActor
    func `transcript facts become one Session projection`() async {
        let (events, continuation) = AsyncStream<TranscriptEvent>.makeStream()
        let sourceURL = URL(fileURLWithPath: "/tmp/session.jsonl")
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let observation = TranscriptObservation(
            id: "session",
            sourceURL: sourceURL,
            events: events,
        )
        let task = Task { await hub.observe(observation) }

        continuation.yield(.headLeaf(uuid: "leaf"))
        continuation.yield(.prompt(text: "Build the native shell\nwith context", atMs: nil))
        continuation.yield(.cwd("/tmp/argo"))
        continuation.yield(.model("claude-opus-5"))
        continuation.yield(.branch("argo/#376-native-shell"))
        continuation.finish()
        await task.value

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
        let (events, continuation) = AsyncStream<TranscriptEvent>.makeStream()
        let sourceURL = URL(fileURLWithPath: "/tmp/session.jsonl")
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let observation = TranscriptObservation(
            id: "session",
            sourceURL: sourceURL,
            events: events,
        )
        let task = Task { await hub.observe(observation) }

        continuation.yield(.prompt(text: "Fallback title", atMs: nil))
        continuation.yield(.title("Host-authored title"))
        continuation.yield(.prompt(text: "Later prompt", atMs: nil))
        continuation.finish()
        await task.value

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

        await hub.connect(using: Engine(), configuration: configuration)

        #expect(hub.connection == .failed(message: "Transcript unavailable"))
        #expect(hub.sessions.isEmpty)
    }

    @Test
    @MainActor
    func `resume files become one root-keyed Session`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let child = try await hubFixtureObservation("resumeChild")
        let parent = try await hubFixtureObservation("resumeParent")

        await hub.observe(child)
        await hub.observe(parent)

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

        await hub.observe(child)
        await hub.observe(parent)

        #expect(hub.sessions[0].cwd == "/tmp/new-worktree")
        #expect(hub.sessions[0].branch == "feature")
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
