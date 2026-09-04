@testable import ArgoEngine
import Foundation
import Testing

/// What a Session keeps of the stream that built it: the fold does not eat what it read, and a
/// resume chain reads as one sequence rather than two files a surface has to re-join.
@Suite("Hub session events")
struct HubSessionEventsTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-events")

    @Test
    @MainActor
    func `a Session retains the events it was built from, in the order they arrived`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "session", events: [
            .prompt(text: "Read the contract", images: [], atMs: 1000),
            .thought(markdown: "The palette is where to start."),
            .message(markdown: "Reading `ArgoPalette` first."),
            .turnEnded(.endTurn),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.events == [
            .prompt(text: "Read the contract", images: [], atMs: 1000),
            .thought(markdown: "The palette is where to start."),
            .message(markdown: "Reading `ArgoPalette` first."),
            .turnEnded(.endTurn),
        ])
    }

    /// The stitch the roster already does for facts, done for prose: a resumed session is one
    /// reading.
    @Test
    @MainActor
    func `a resumed chain's events stitch into one sequence, root first`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let root = hubTestObservation(id: "root", events: [
            .recordIdentity(uuid: "root-leaf"),
            .message(markdown: "Before the resume."),
        ])
        let child = hubTestObservation(id: "child", events: [
            .headLeaf(uuid: "root-leaf"),
            .message(markdown: "After the resume."),
        ])

        // Continuation first, so the answer cannot be the order the tails happened to start in.
        await hubObserveToEnd(hub, child)
        await hubObserveToEnd(hub, root)

        let session = try #require(hub.sessions.first)
        #expect(session.events.compactMap(\.spokenMarkdown) == [
            "Before the resume.",
            "After the resume.",
        ])
    }

    /// A tail hands over what a file already held and then what is written to it; the second batch
    /// lands behind the first rather than replacing it.
    @Test
    @MainActor
    func `events written after the backfill land behind it`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let (observation, continuation) = hubLiveObservation(id: "live")
        await hub.startObserving(observation)

        continuation.yield([.message(markdown: "First.")])
        await hubSettle { hub.sessions.first?.events.isEmpty == false }
        continuation.yield([.message(markdown: "Second.")])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "live")

        let session = try #require(hub.sessions.first)
        #expect(session.events.compactMap(\.spokenMarkdown) == ["First.", "Second."])
    }
}

private extension TranscriptEvent {
    /// The markdown of a prose event, so an order assertion reads as prose and not a list of cases.
    var spokenMarkdown: String? {
        switch self {
        case let .message(markdown), let .thought(markdown): markdown
        case .recordIdentity, .headLeaf, .originSession, .title, .cwd, .model, .effort,
             .branch, .mode, .entry,
             .prompt, .toolCall,
             .toolCallOutcome, .turnEnded, .interrupted, .plan, .usage, .compaction, .queued,
             .unreadableLine,
             .skillLoaded, .excerpted: nil
        }
    }
}
