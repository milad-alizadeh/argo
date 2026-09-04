import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// The wait on a Turn Argo put, and what its ending frees (#1337).
///
/// A put follow-up claims the Turn it starts, and the claim is spent by a Turn read RUNNING —
/// which is what stops the rest of the queue going to a CLI already busy. Some Turns are never
/// read running at all, so the claim is given a bounded time and then spent anyway; these are the
/// cases for that ending. Its own suite because the release suite is at its body ceiling.
@Suite("Composer put wait")
@MainActor
struct ComposerPutWaitTests {
    /// The hole one-per-boundary would otherwise open: the claim a put leaves is spent by a Turn
    /// read RUNNING, and some Turns are never read running at all — one short enough that no
    /// reading caught it, one the CLI never heard. Left standing, the claim holds the rest of the
    /// queue for ever, which is the reported defect with the chips still on screen.
    @Test
    func `a put Turn the record never shows does not strand what is behind it`() async {
        let log = Log()
        queue("And then open the PR.", in: log)
        queue("Then tag it.", in: log)
        composer(log, at: .idle).turnEnded()
        #expect(log.sent == ["And then open the PR."])
        #expect(log.draft.isAwaitingPutTurn)

        // The wait runs out with no reading of that Turn ever having come.
        await composer(log, at: .idle).watchPut(patience: .zero)
        #expect(!log.draft.isAwaitingPutTurn)
        // Spending the claim is a movement in what the release reads, so the level is asked again.
        composer(log, at: .idle).release()

        #expect(log.sent == ["And then open the PR.", "Then tag it."])
        #expect(log.draft.queued.isEmpty)
    }

    /// …and it says nothing while it does that. Nothing is known to have gone wrong — the Turn may
    /// simply have come and gone between two readings — so a line about it would be a false DIRECT.
    @Test
    func `the wait on a put Turn puts no line on the seam`() async {
        let log = Log()
        queue("And then open the PR.", in: log)
        composer(log, at: .idle).turnEnded()

        await composer(log, at: .idle).watchPut(patience: .zero)

        #expect(ComposerSeamNote.note(for: log.draft, enteredAtMs: 0) == nil)
    }

    /// A wait armed for a put whose Turn the record DID show takes nothing away: the claim it was
    /// waiting on is already spent, and the one standing after it belongs to a later put.
    @Test
    func `a wait whose claim was already spent does nothing`() async {
        let log = Log()
        queue("And then open the PR.", in: log)
        composer(log, at: .idle).turnEnded()
        // The record catches up, which is what spends the claim.
        composer(log, at: .running).turnRead(false)

        await composer(log, at: .running).watchPut(patience: .zero)

        #expect(log.sent == ["And then open the PR."])
        #expect(!log.draft.isAwaitingPutTurn)
    }
}
