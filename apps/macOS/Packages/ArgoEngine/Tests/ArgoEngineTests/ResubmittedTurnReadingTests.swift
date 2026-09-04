@testable import ArgoEngine
import Foundation
import Testing

/// What a READING does with the marker the reader emits (#1202): it takes the abandoned branch
/// back out, and it says so loudly enough that everything downstream re-derives.
///
/// Where the marker comes from is `ResubmittedTurnTests`.
@Suite("A superseded branch")
struct ResubmittedTurnReadingTests {
    /// Everything the abandoned branch wrote goes with it, not the prompt alone: the CLI answers a
    /// forked Turn on the branch it kept, so a reply left standing under a dropped prompt would be
    /// an answer to nothing.
    @Test
    func `what the abandoned branch wrote goes with it`() {
        let session = sessionReading(of: [
            .recordIdentity(uuid: "first"),
            .prompt(text: "again", images: [], atMs: 1),
            .message(markdown: "half an answer"),
            .superseded(fromRecord: "first"),
            .recordIdentity(uuid: "second"),
            .prompt(text: "again", images: [], atMs: 2),
        ])

        #expect(promptsDrawn(in: session.events) == ["again"])
        #expect(said(by: session).isEmpty)
    }

    /// A record the reading never saw supersedes nothing. The first half of a transcript can be
    /// behind an excerpt's seam, and a fold that dropped the whole stream for want of the uuid it
    /// was pointed at would empty a feed rather than tidy one (`CONTEXT.md` Honesty tier).
    @Test
    func `a branch the reading never saw drops nothing`() {
        let session = sessionReading(of: [
            .excerpted,
            .recordIdentity(uuid: "kept"),
            .prompt(text: "carried across the seam", images: [], atMs: 1),
            .superseded(fromRecord: "behind the seam"),
            .recordIdentity(uuid: "second"),
            .prompt(text: "asked again", images: [], atMs: 2),
        ])

        #expect(promptsDrawn(in: session.events) == ["carried across the seam", "asked again"])
    }

    /// A fork drops exactly what it re-adds — the abandoned record's events for the superseding
    /// record's — so the reading's LENGTH can come back to the number it was last drawn at while
    /// the rows underneath it changed completely.
    ///
    /// This is what `SessionsRoomReadingCache` keys on, and why it keys on the stamp rather than
    /// the count: keyed on a length, the deck would hold the cached feed and go on drawing exactly
    /// the branch this ticket exists to remove.
    @Test
    func `a fork moves the stamp even where it does not move the count`() {
        var forked = sessionReading(of: [
            .recordIdentity(uuid: "first"),
            .prompt(text: "did you fix the issues", images: [], atMs: 1),
        ])
        let drawn = forked.transcriptStamp
        let count = forked.events.count

        for event in [
            TranscriptEvent.superseded(fromRecord: "first"),
            .recordIdentity(uuid: "second"),
            .prompt(text: "did you fix the issues", images: [], atMs: 2),
        ] {
            forked.apply(event)
        }

        #expect(forked.events.count == count)
        #expect(forked.transcriptStamp != drawn)
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

        #expect(promptsDrawn(in: hub.sessions.first?.events ?? []) == ["did you fix the issues"])
    }
}
