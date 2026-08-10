@testable import ArgoEngine
import Foundation
import Testing

/// What a transcript has to carry before it is a Session anybody is shown.
///
/// Built from the shape the real files have. The CLI opens a transcript the moment a prompt is
/// QUEUED, so a Session that queued several leaves several files, each holding two
/// `queue-operation` records, one copy of the same prompt, a handful of attachments — and no agent
/// output at all. The roster drew that Session once per file, every copy carrying the same title
/// derived from the same words.
@Suite("Queued prompts are not Sessions")
struct QueuedPromptTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-queued")

    @Test
    @MainActor
    func `a queued prompt nothing answered is not on the roster`() async {
        let hub = testHub(projectURL: Self.projectURL)

        await hubObserveToEnd(hub, hubTestObservation(id: "queued", events: [
            .queued,
            .cwd(Self.projectURL.path),
            .prompt(text: "implement the roster row ticket", atMs: 1000),
        ]))

        #expect(hub.sessions.isEmpty)
    }

    @Test
    @MainActor
    func `three prompts queued off one Session do not become three rows`() async {
        let hub = testHub(projectURL: Self.projectURL)

        for index in 0 ..< 3 {
            await hubObserveToEnd(hub, hubTestObservation(id: "queued-\(index)", events: [
                .queued,
                .cwd(Self.projectURL.path),
                .prompt(text: "implement the roster row ticket", atMs: 1000),
            ]))
        }

        // The exact rendering that sent this up: one title, three times over.
        #expect(hub.sessions.isEmpty)
    }

    /// The half that stops this from hiding live work: a Session that has only just started has a
    /// prompt and no answer yet, and it is perfectly real.
    @Test
    @MainActor
    func `a Session whose agent has not answered yet is still a Session`() async throws {
        let hub = testHub(projectURL: Self.projectURL)

        await hubObserveToEnd(hub, hubTestObservation(id: "starting", events: [
            .cwd(Self.projectURL.path),
            .prompt(text: "implement the roster row ticket", atMs: 1000),
        ]))

        #expect(try #require(hub.sessions.first).title == "implement the roster row ticket")
    }

    /// The other half: the queue is how a prompt ARRIVED, not what the Session is.
    @Test
    @MainActor
    func `a queued prompt an agent picked up is an ordinary Session`() async throws {
        let hub = testHub(projectURL: Self.projectURL)

        await hubObserveToEnd(hub, hubTestObservation(id: "answered", events: [
            .queued,
            .cwd(Self.projectURL.path),
            .prompt(text: "implement the roster row ticket", atMs: 1000),
            .message(markdown: "Starting on it."),
        ]))

        #expect(try #require(hub.sessions.first).title == "implement the roster row ticket")
    }

    /// Dropped at publication and not at discovery, so the file is still tailed: an agent picking
    /// the prompt up later brings the row in without another sweep having to find it.
    @Test
    @MainActor
    func `the row arrives if an agent picks the queued prompt up`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let (observation, continuation) = hubLiveObservation(id: "later")
        await hub.startObserving(observation)

        continuation.yield([.queued, .prompt(text: "implement the roster row", atMs: 1000)])
        await hubSettle { hub.sessions.isEmpty }
        continuation.yield([.message(markdown: "Picked it up.")])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "later")

        #expect(hub.sessions.count == 1)
    }

    @Test
    @MainActor
    func `a resume file nobody has answered keeps the reading it continues`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let root = hubTestObservation(id: "root", events: [
            .recordIdentity(uuid: "root-leaf"),
            .message(markdown: "The agent spoke here."),
        ])
        // Queued and unanswered on its own, but it continues a chain that ran. It must not take
        // the whole reading off the roster with it.
        let child = hubTestObservation(id: "child", events: [
            .headLeaf(uuid: "root-leaf"),
            .queued,
            .prompt(text: "carry on", atMs: 2000),
        ])

        await hubObserveToEnd(hub, root)
        await hubObserveToEnd(hub, child)

        #expect(hub.sessions.count == 1)
    }
}
