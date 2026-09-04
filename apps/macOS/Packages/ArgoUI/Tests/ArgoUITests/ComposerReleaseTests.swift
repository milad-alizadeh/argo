import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// When what is waiting on a Turn actually goes (#1238).
///
/// The defect these were written from: a follow-up queued behind a running Turn stayed a chip for
/// ever. The release hung on ONE edge — "a Turn is no longer running" — and `permission` and
/// `asking` both come off `.running` mid-Turn, so the edge was spent at a pause the Turn came back
/// from and the true end fired nothing at all.
///
/// So there are two claims here, and every case is one of them: the Turn's END is a different
/// question from a Turn RUNNING, and the release is a level that any later reading can make.
@Suite("Composer release")
@MainActor
struct ComposerReleaseTests {
    // MARK: - What ends a Turn

    /// The whole of the first claim, stated over every status there is: a Turn PAUSED on a
    /// question has not ended. Exhaustive on purpose — a new status added without an answer here
    /// would default to whichever side the author of that status happened to think of.
    @Test(arguments: SessionStatus.allCases)
    func `only a quiet reading ends the Turn`(status: SessionStatus) {
        let inFlight: Set<SessionStatus> = [.running, .starting, .permission, .asking]

        #expect(SessionComposerProjection.hasTurnEnded(status) == !inFlight.contains(status))
    }

    /// The reading the old release actually used, kept beside the new one so the difference is
    /// stated rather than implied: `permission` and `asking` are both "not running" AND "not
    /// ended", and that gap is where the follow-up was lost.
    @Test(arguments: [SessionStatus.permission, .asking])
    func `a paused Turn is neither running nor ended`(status: SessionStatus) {
        #expect(status != .running)
        #expect(!SessionComposerProjection.hasTurnEnded(status))
    }

    // MARK: - The ordinary case

    /// The ticket's own reproduction, driven through the vessel: a follow-up queued mid-Turn, and
    /// a Session walked `running` → `idle`. It goes exactly once, and the chip goes with it.
    @Test
    func `a follow-up queued while running is sent once when the Session goes idle`() {
        let log = Log()
        queue("And then open the PR.", in: log)

        walk([.running, .idle], log)

        #expect(log.sent == ["And then open the PR."])
        #expect(log.draft.queued.isEmpty)
    }

    /// The defect itself. The Turn pauses on a permission and on a question before it ends, and
    /// both readings come off `.running` — under the old edge the first of them spent the release
    /// and the end fired nothing. The follow-up must go once, at the END, and not at either pause.
    @Test
    func `a Turn that pauses before it ends still releases the follow-up, once`() {
        let log = Log()
        queue("And then open the PR.", in: log)

        walk([.running, .permission, .running, .asking, .running, .idle], log)

        #expect(log.sent == ["And then open the PR."])
        #expect(log.draft.queued.isEmpty)
    }

    /// The other half of that claim, which the count above cannot make on its own: nothing goes
    /// while the Turn is merely paused. A follow-up put to a CLI holding a permission open is
    /// answering a question nobody asked.
    @Test(arguments: [SessionStatus.permission, .asking, .starting])
    func `nothing is released at a pause`(pause: SessionStatus) {
        let log = Log()
        queue("And then open the PR.", in: log)

        walk([.running, pause], log)

        #expect(log.sent.isEmpty)
        #expect(log.draft.queued.map(\.text) == ["And then open the PR."])
    }

    /// Every path out of `.running` that ends the Turn releases it — `stopped` and `ended` are
    /// ends as truly as `idle` is, and a queue stranded behind one has nothing to try it again.
    @Test(arguments: [SessionStatus.idle, .stopped, .ended, .unknown])
    func `every reading that ends the Turn releases what waited`(end: SessionStatus) {
        let log = Log()
        queue("And then open the PR.", in: log)

        walk([.running, end], log)

        #expect(log.sent == ["And then open the PR."])
    }

    // MARK: - The level

    /// The level, stated on its own: a release the boundary could not make is made at the next
    /// reading rather than lost. Here the boundary goes by while a walk holds the release, and the
    /// walk landing is what opens it — no second boundary is needed, and none comes.
    @Test
    func `a release the boundary could not make is made at the next reading`() {
        let log = Log()
        log.draft = ComposerDraft(queued: [QueuedTurn(text: "carry on")], heldMode: .auto)
        log.draft.isWalkingMode = true
        let vessel = composer(log, at: .idle)

        // The boundary: a walk is already under way, so nothing may go.
        vessel.turnEnded()
        #expect(log.sent.isEmpty)
        // The walk lands, which is a movement in what the release reads and nothing else.
        log.draft.modeLanded(.auto)
        vessel.release()

        #expect(log.sent == ["carry on"])
        #expect(log.draft.queued.isEmpty)
    }

    /// The rung and the queue at one boundary, in the order the boundary decides (#940): the walk
    /// runs FIRST, because a follow-up released ahead of it would run under a stance its author
    /// had already moved — and it would put the Session back to running, which refuses the walk.
    ///
    /// Synchronous on purpose: what it claims is everything the boundary does before it awaits
    /// anything, and the case below carries the other half.
    @Test
    func `a rung held with a follow-up behind it gives the release to the walk`() {
        let log = Log()
        log.draft = ComposerDraft(queued: [QueuedTurn(text: "carry on")], heldMode: .auto)

        composer(log, at: .idle).turnEnded()

        #expect(log.draft.isWalkingMode)
        #expect(log.sent.isEmpty)
        #expect(log.draft.queued.map(\.text) == ["carry on"])
    }

    /// …and the other half: the walk's own follow-through is the queue, so the follow-up goes
    /// AFTER the rung it was queued behind rather than being stranded by it.
    @Test
    func `the walk that took the release then releases the queue`() async {
        let log = Log()
        log.draft = ComposerDraft(queued: [QueuedTurn(text: "carry on")], heldMode: .auto)

        await composer(log, at: .idle).honour(.auto)

        #expect(log.acts == ["walk auto", "send carry on"])
        #expect(log.draft.queued.isEmpty)
        #expect(log.draft.heldMode == nil)
    }

    /// A level asked at every reading must not become a level that acts at every reading: the same
    /// words put to the same port twice is worse than the defect this fixes.
    @Test
    func `asking the release again after it went sends nothing more`() {
        let log = Log()
        queue("And then open the PR.", in: log)
        let vessel = composer(log, at: .idle)

        vessel.turnEnded()
        vessel.release()
        vessel.release()

        #expect(log.sent == ["And then open the PR."])
    }

    // MARK: - A refusal

    /// A refused release says so in BOTH places, which is what the reported state could not: the
    /// seam carries the port's reason with the Retry that answers it, and the chip that was
    /// reached says it was not sent — so a refused release and one that never ran stop looking
    /// alike.
    @Test
    func `a follow-up held back by a refusal says so on the seam and on its chip`() {
        let log = Log()
        queue("And then open the PR.", in: log)
        queue("Then tag it.", in: log)

        walk([.running, .idle], log, refusing: .notDrivable)

        #expect(log.sent.isEmpty)
        #expect(log.draft.queued.count == 2)
        #expect(
            ComposerSeamNote.note(for: log.draft, enteredAtMs: 0)
                == .refusal(ComposerSeamLine(SessionDriveError.notDrivable.detail)),
        )
        // The one the release reached, and only that one: the second was never tried.
        #expect(log.draft.refusedTurn == log.draft.queued[0].id)
    }

    /// The remedy the seam offers, end to end. Retry is the reader's act and the only thing that
    /// puts a refused release again — the level itself must never keep trying.
    @Test
    func `a refused release is not retried on its own, and Retry sends it`() {
        let log = Log()
        queue("And then open the PR.", in: log)
        walk([.running, .idle], log, refusing: .notDrivable)

        // Every later reading of a Session whose Turn is over, with the refusal standing.
        let vessel = composer(log, at: .idle)
        vessel.release()
        vessel.release()
        #expect(log.sent.isEmpty)
        composer(log, at: .idle).retry()

        #expect(log.sent == ["And then open the PR."])
        #expect(log.draft.queued.isEmpty)
        #expect(log.draft.refusedTurn == nil)
    }

    /// Nothing was refused, so no chip may claim it was — the chip's word is read off the standing
    /// refusal, and a queue simply waiting wears the ordinary one.
    @Test
    func `a queue that was never tried marks no follow-up as refused`() {
        let log = Log()
        queue("And then open the PR.", in: log)

        #expect(log.draft.refusedTurn == nil)
    }

    /// Cancelling the refused chip must not hand its word to the one behind it. That one was never
    /// reached, and a `NOT SENT` over a follow-up nothing tried is the very mislabel the word
    /// exists to prevent — one click away, in the same row.
    @Test
    func `cancelling the refused follow-up leaves the next one merely queued`() {
        let log = Log()
        queue("And then open the PR.", in: log)
        queue("Then tag it.", in: log)
        walk([.running, .idle], log, refusing: .notDrivable)

        log.draft.cancel(log.draft.queued[0].id)

        #expect(log.draft.queued.map(\.text) == ["Then tag it."])
        #expect(log.draft.refusedTurn != log.draft.queued[0].id)
    }
}
