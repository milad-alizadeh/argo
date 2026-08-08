@testable import ArgoEngine
import Foundation
import Testing

/// What a Session keeps of the stream that built it.
///
/// The facts a roster row draws are a fold over the transcript; the feed is the transcript. These
/// are the assertions that the fold no longer eats what it read, and that a resume chain reads as
/// one sequence rather than as two files a surface would have to re-join.
@Suite("Hub session events")
struct HubSessionEventsTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-events")

    @Test
    @MainActor
    func `a Session retains the events it was built from, in the order they arrived`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "session", events: [
            .prompt(text: "Read the contract", atMs: 1000),
            .thought(markdown: "The palette is where to start."),
            .message(markdown: "Reading `ArgoPalette` first."),
            .turnEnded(.endTurn),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.events == [
            .prompt(text: "Read the contract", atMs: 1000),
            .thought(markdown: "The palette is where to start."),
            .message(markdown: "Reading `ArgoPalette` first."),
            .turnEnded(.endTurn),
        ])
    }

    /// The stitch the roster already does for facts, done for prose: a resumed session is one
    /// reading, and a feed that started over at the resume would lose everything before it.
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

    /// A tail hands over what a file already held and then keeps handing over what is written to
    /// it. The second batch has to land behind the first rather than replace it — which is what a
    /// feed that grows without the user reselecting the Session IS.
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
    /// The markdown of a prose event, so an assertion about ORDER reads as the prose it is about
    /// rather than as a list of cases.
    var spokenMarkdown: String? {
        switch self {
        case let .message(markdown), let .thought(markdown): markdown
        case .recordIdentity, .headLeaf, .title, .cwd, .model, .branch, .prompt, .toolCall,
             .toolCallOutcome, .turnEnded, .plan, .compaction, .unreadableLine: nil
        }
    }
}
