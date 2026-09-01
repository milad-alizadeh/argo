@testable import ArgoEngine
import Foundation
import Testing

/// The stamp the cockpit compares a Session's whole decoded stream BY, and the one thing that can
/// make it a rendered lie: standing still while the stream moved (`CONTEXT.md` Honesty tier).
///
/// One case per way a stream can change, and the list is complete because the records are private
/// to `TranscriptStream` — every write goes through one of the two mutators below, and each is a
/// `didSet` away from the restamp.
///
/// One case LEFT this suite with #858, and its absence is the honest record of what changed: a
/// continuation rewritten at the same length used to be buildable by growing it under a Subagent
/// while its own stream stood still. A Subagent's file is not in this stream any more, and with one
/// append-only stream every write moves the length — so that case cannot be built through a live
/// Session at all. `TranscriptStamp.writes` stays for the reason its own comment gives: it is what
/// stops append-only being an invariant somebody has to keep.
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
