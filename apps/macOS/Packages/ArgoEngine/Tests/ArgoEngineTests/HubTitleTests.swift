@testable import ArgoEngine
import Foundation
import Testing

/// How a Session earns its roster name: the host's own title wins, the first prompt stands in for
/// it, and the plumbing a fresh transcript opens with never locks the row.
@Suite("Hub titles")
struct HubTitleTests {
    @Test
    @MainActor
    func `a bare slash command stands in as the title only until a real prompt arrives`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        // What /clear leaves as the new transcript's first prompt. Verbatim it is the whole
        // title, and locking on it names the Session after the plumbing that opened it.
        continuation.yield([.prompt(text: "/clear", atMs: nil)])
        continuation.yield([.prompt(text: "Fix the roster titles", atMs: nil)])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(hub.sessions[0].title == "Fix the roster titles")
    }

    @Test
    @MainActor
    func `a bare slash command is still the title when nothing follows it`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        continuation.yield([.prompt(text: "/clear", atMs: nil)])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        // Better than the transcript filename, which is a UUID — the command at least says what
        // the user did.
        #expect(hub.sessions[0].title == "/clear")
    }

    @Test
    @MainActor
    func `a slash command with arguments locks the title like any prompt`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        continuation.yield([.prompt(text: "/implement 433", atMs: nil)])
        continuation.yield([.prompt(text: "Later steering", atMs: nil)])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(hub.sessions[0].title == "/implement 433")
    }

    @Test
    @MainActor
    func `a continuation's provisional title beats the filename fallback`() async throws {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let root = hubTestObservation(id: "root", events: [
            .recordIdentity(uuid: "root-leaf"),
        ])
        let child = hubTestObservation(id: "child", events: [
            .headLeaf(uuid: "root-leaf"),
            .prompt(text: "/clear", atMs: nil),
        ])

        await hubObserveToEnd(hub, child)
        await hubObserveToEnd(hub, root)

        let session = try #require(hub.sessions.first)
        #expect(session.title == "/clear")
    }

    @Test
    @MainActor
    func `the host title replaces the prompt fallback`() async {
        let (observation, continuation) = hubLiveObservation(id: "session")
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hub.startObserving(observation)

        continuation.yield([.prompt(text: "Fallback title", atMs: nil)])
        continuation.yield([.title("Host-authored title")])
        continuation.yield([.prompt(text: "Later prompt", atMs: nil)])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(hub.sessions[0].title == "Host-authored title")
    }
}
