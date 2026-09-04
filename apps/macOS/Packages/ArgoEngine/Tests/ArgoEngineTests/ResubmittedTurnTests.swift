@testable import ArgoEngine
import Foundation
import Testing

/// One submitted Turn draws one prompt row (#1202).
///
/// The transcript is a TREE, not a list: `parentUuid` names the record each one answers. A Turn
/// submitted twice — a Return the composer sent again, a rewind, an edited prompt — leaves TWO
/// children on one parent, and only the later of them is the branch the CLI went on with. The file
/// keeps both, so a reader that appends every line in file order draws the same words twice with
/// one answer under them, which is exactly what the issue's screenshot shows.
///
/// The shapes here are verbatim from `claude` 2.1.226: two `user` records, seconds apart, carrying
/// the same text, different uuids and ONE parentUuid between them.
@Suite("A resubmitted Turn")
struct ResubmittedTurnTests {
    private func prompt(_ uuid: String, under parent: String?, saying text: String) -> String {
        let parentField = parent.map { "\"\($0)\"" } ?? "null"
        return """
        {"type": "user", "parentUuid": \(parentField), "message": {"role": "user", \
        "content": "\(text)"}, "uuid": "\(uuid)", "sessionId": "s"}
        """
    }

    private func prompts(_ events: [TranscriptEvent]) -> [String] {
        events.compactMap { event in
            guard case let .prompt(text, _, _) = event else { return nil }
            return text
        }
    }

    private func session(reading events: [TranscriptEvent]) -> HubSession {
        var session = HubSession(observation: TranscriptObservation(
            id: "s",
            sourceURL: URL(fileURLWithPath: "/tmp/s.jsonl"),
            events: AsyncStream { $0.finish() },
        ))
        for event in events {
            session.apply(event)
        }
        return session
    }

    @Test
    func `a second prompt on one parent supersedes the first`() async {
        let reader = TranscriptReader()
        let lines = [
            prompt("first", under: "boundary", saying: "did you fix the issues"),
            prompt("second", under: "boundary", saying: "did you fix the issues"),
        ]

        let read = await reader.read(lines: lines)

        #expect(read.contains(.superseded(fromRecord: "first")))
    }

    /// The whole of the acceptance criterion: the row holds one of them, not two.
    @Test
    func `the abandoned branch leaves one row behind`() async {
        let reader = TranscriptReader()
        let lines = [
            prompt("first", under: "boundary", saying: "did you fix the issues"),
            prompt("second", under: "boundary", saying: "did you fix the issues"),
        ]

        let read = await reader.read(lines: lines)

        #expect(prompts(session(reading: read).events) == ["did you fix the issues"])
    }

    /// Everything the abandoned branch wrote goes with it, not the prompt alone: the CLI answers a
    /// forked Turn on the branch it kept, so a reply left standing under a dropped prompt would be
    /// an answer to nothing.
    @Test
    func `what the abandoned branch wrote goes with it`() {
        let session = session(reading: [
            .recordIdentity(uuid: "first"),
            .prompt(text: "again", images: [], atMs: 1),
            .message(markdown: "half an answer"),
            .superseded(fromRecord: "first"),
            .recordIdentity(uuid: "second"),
            .prompt(text: "again", images: [], atMs: 2),
        ])

        #expect(prompts(session.events) == ["again"])
        #expect(said(by: session).isEmpty)
    }

    /// An ordinary conversation is a chain of single children, and nothing in it is superseded —
    /// the guard that keeps this reading from eating a feed.
    @Test
    func `a conversation nobody forked keeps every prompt`() async {
        let reader = TranscriptReader()
        let lines = [
            prompt("one", under: nil, saying: "first"),
            prompt("two", under: "one", saying: "second"),
            prompt("three", under: "two", saying: "third"),
        ]

        let read = await reader.read(lines: lines)

        #expect(!read.contains { event in
            guard case .superseded = event else { return false }
            return true
        })
        #expect(prompts(session(reading: read).events) == ["first", "second", "third"])
    }

    /// A record the reading never saw supersedes nothing. The first half of a transcript can be
    /// behind an excerpt's seam, and a fold that dropped the whole stream for want of the uuid it
    /// was pointed at would empty a feed rather than tidy one (`CONTEXT.md` Honesty tier).
    @Test
    func `a branch the reading never saw drops nothing`() {
        let session = session(reading: [
            .excerpted,
            .recordIdentity(uuid: "kept"),
            .prompt(text: "carried across the seam", images: [], atMs: 1),
            .superseded(fromRecord: "behind the seam"),
            .recordIdentity(uuid: "second"),
            .prompt(text: "asked again", images: [], atMs: 2),
        ])

        #expect(prompts(session.events) == ["carried across the seam", "asked again"])
    }

    /// The whole shape at once, in the CLI's own bytes: one Turn put twice leaves one prompt and
    /// the answer the CLI actually gave, with the half-answer it abandoned gone from both.
    ///
    /// The fixture's field set is verbatim from `claude` 2.1.226 — the `promptId`, `promptSource`
    /// and `permissionMode` a typed prompt carries, and the two sibling uuids under one
    /// `parentUuid` that are the fork itself.
    @Test
    func `the CLI's own bytes draw one prompt and one answer`() async throws {
        let session = try await session(reading: Fixture.events("resubmittedTurn"))

        #expect(prompts(session.events) == ["open the session", "did you fix the issues"])
        #expect(said(by: session) == ["Opened.", "Yes, all of them."])
    }

    /// The re-key case (#1176). The fork's two halves can arrive in two batches — the first under
    /// the row's provisional id and the second after the row has taken the CLI's own — and the
    /// fold is over the READING, which is what the re-key carries across. So a row that already
    /// drew the first prompt still folds to one when the second lands.
    @Test
    @MainActor
    func `a fork that lands in two batches still folds to one row`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-1202"))
        let (observation, batches) = hubLiveObservation(id: "session")

        await hub.startObserving(observation)
        batches.yield([
            .recordIdentity(uuid: "first"),
            .prompt(text: "did you fix the issues", images: [], atMs: 1),
        ])
        await hubSettle(until: { hub.sessions.first?.events.isEmpty == false })
        batches.yield([
            .superseded(fromRecord: "first"),
            .recordIdentity(uuid: "second"),
            .prompt(text: "did you fix the issues", images: [], atMs: 2),
            .message(markdown: "yes"),
        ])
        batches.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(prompts(hub.sessions.first?.events ?? []) == ["did you fix the issues"])
    }
}
