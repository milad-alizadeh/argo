@testable import ArgoEngine
import Foundation
import Testing

/// The stamp the cockpit compares a Session's whole decoded stream BY, and the one thing that can
/// make it a rendered lie: standing still while the stream moved (`CONTEXT.md` Honesty tier).
///
/// One case per way a stream can change, and the list is complete because the two collections are
/// private to `TranscriptStream` — every write to either goes through one of the three mutators
/// below, and each of those is a `didSet` away from the restamp.
@Suite("Transcript stamp")
@MainActor
struct TranscriptStampTests {
    /// The tail's own path: one event at a time, whatever kind it is. The `switch` that folds the
    /// event's meaning sits BELOW the append, so no kind can reach the stream without moving this.
    @Test
    func `an event applied moves the stamp`() {
        var session = Self.session(id: "root")
        let before = session.transcriptStamp

        session.apply(.message(markdown: "said"))

        #expect(session.transcriptStamp != before)
    }

    /// A kind that folds to nothing — `unreadableLine` sets no fact at all — still lands in the
    /// stream, so it still has to move the stamp: the feed draws a row for it.
    @Test
    func `an event that changes no folded fact moves the stamp too`() {
        var session = Self.session(id: "root")
        let before = session.transcriptStamp

        session.apply(.unreadableLine(raw: "{"))

        #expect(session.transcriptStamp != before)
    }

    /// A Subagent's own file, which grows under a Session whose own stream stands still.
    @Test
    func `a subagent's read moves the stamp`() {
        var session = Self.session(id: "root")
        let before = session.transcriptStamp

        session.apply([.message(markdown: "child")], ofSubagent: "a-one")

        #expect(session.transcriptStamp != before)
    }

    /// Two Subagents, same batch each: the second must not land on the stamp the first gave it.
    @Test
    func `a second subagent's read moves the stamp again`() {
        var session = Self.session(id: "root")
        session.apply([.message(markdown: "child")], ofSubagent: "a-one")
        let before = session.transcriptStamp

        session.apply([.message(markdown: "child")], ofSubagent: "a-two")

        #expect(session.transcriptStamp != before)
    }

    @Test
    func `a resume merged in moves the stamp`() {
        var session = Self.session(id: "root")
        var continuation = Self.session(id: "second")
        continuation.apply(.message(markdown: "later"))
        let before = session.transcriptStamp

        session.mergeContinuation(continuation)

        #expect(session.transcriptStamp != before)
    }

    /// The case a write COUNT alone would miss, and the reason the continuation's own count is
    /// folded in: every rebuild re-runs the same two writes over the same root, so a merge of a
    /// continuation that has since grown would otherwise land on the stamp the shorter one gave it.
    @Test
    func `a continuation that grew restamps the chain that merged it`() {
        var continuation = Self.session(id: "second")
        continuation.apply(.message(markdown: "later"))
        var short = Self.session(id: "root")
        short.mergeContinuation(continuation)

        continuation.apply(.message(markdown: "later still"))
        var grown = Self.session(id: "root")
        grown.mergeContinuation(continuation)

        #expect(grown.transcriptStamp != short.transcriptStamp)
    }

    /// The same case with the LENGTH held still, which is what makes the write count load-bearing:
    /// the continuation read the same number of events under a Subagent instead of its own stream,
    /// so both halves of the merged length are unchanged.
    @Test
    func `a continuation rewritten at the same length restamps the chain too`() {
        var continuation = Self.session(id: "second")
        continuation.apply([.message(markdown: "child")], ofSubagent: "a-one")
        var once = Self.session(id: "root")
        once.mergeContinuation(continuation)

        continuation.apply([], ofSubagent: "a-one")
        var twice = Self.session(id: "root")
        twice.mergeContinuation(continuation)

        #expect(twice.transcriptStamp != once.transcriptStamp)
    }

    /// The inverse, and the claim the cockpit rests on: a Session nothing wrote to keeps its stamp,
    /// through the copies a rebuild makes of it.
    @Test
    func `a stream nothing wrote to keeps its stamp`() {
        var session = Self.session(id: "root")
        session.apply(.message(markdown: "said"))
        let before = session.transcriptStamp

        let copy = session

        #expect(copy.transcriptStamp == before)
    }

    /// And the same through the merge a rebuild re-runs: the fold is deterministic, so the roster
    /// published twice off unchanged transcripts is the same value twice.
    @Test
    func `a rebuild off unchanged transcripts publishes the same stamp`() {
        var continuation = Self.session(id: "second")
        continuation.apply(.message(markdown: "later"))
        var first = Self.session(id: "root")
        var second = Self.session(id: "root")

        first.mergeContinuation(continuation)
        second.mergeContinuation(continuation)

        #expect(first.transcriptStamp == second.transcriptStamp)
    }

    private static func session(id: String) -> HubSession {
        HubSession(observation: hubTestObservation(id: id, events: []))
    }
}
