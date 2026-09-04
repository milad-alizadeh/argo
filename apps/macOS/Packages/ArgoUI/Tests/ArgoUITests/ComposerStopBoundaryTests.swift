import ArgoEngine
@testable import ArgoUI
import Testing

/// WHO stopped the Turn, and what the composer does about it (#1189).
///
/// Split from `ComposerInterruptTests`, which is about what Argo's own Stop button leaves in the
/// vessel. This is the half that half cannot see: a Turn stopped somewhere else — an `ESC` at the
/// dock terminal, a Stop pressed in another window — ends it just as truly, and the follow-ups
/// waiting on it were written for the run that was killed either way. Until the record was read as
/// CLOSING the Turn, no such Session ever came off `running`, so nothing here could fire; now it
/// can, and left unanswered it would release them into the run somebody just killed.
@Suite("Composer stop boundary")
@MainActor
struct ComposerStopBoundaryTests {
    /// What the composer asks the record: was the last boundary somebody stopping the Turn?
    /// Backwards to the NEAREST boundary and no further — every Turn before it has its own answer,
    /// and the one that just ended is the only one anything is waiting on.
    @Test
    func `the last boundary is what says whether the Turn was stopped`() {
        let stopped: [TranscriptEvent] = [
            .prompt(text: "Rename the column.", images: [], atMs: 0),
            .interrupted(atMs: 1),
        ]
        let finished: [TranscriptEvent] = [
            .prompt(text: "…", images: [], atMs: 0),
            .turnEnded(.endTurn),
        ]

        #expect(SessionComposerProjection.endedByInterrupt(stopped))
        #expect(!SessionComposerProjection.endedByInterrupt(finished))
        // A Turn stopped, then another run through to its own end: the older boundary says nothing.
        #expect(!SessionComposerProjection.endedByInterrupt(stopped + finished))
        // …and the other way round.
        #expect(SessionComposerProjection.endedByInterrupt(finished + stopped))
        // A record with no boundary in it at all claims nothing.
        #expect(!SessionComposerProjection.endedByInterrupt([.message(markdown: "Working…")]))
    }

    @Test
    func `a Turn stopped outside Argo drops the queue rather than releasing it`() {
        var draft = ComposerDraft()
        draft.text = "And then open the PR."
        draft.submit(whileTurnInFlight: true) { _, _ in }

        let mustDrop = draft.mustDropQueue(afterInterrupt: true)
        #expect(mustDrop)
        draft.dropQueue()

        #expect(draft.queued.isEmpty)
        #expect(draft.notice == ComposerDraft.droppedQueue)
    }

    /// A Turn that simply FINISHED releases what was waiting on it, which is decision 4's ordinary
    /// case and the one this must not break.
    @Test
    func `a Turn that ended on its own releases the queue`() {
        var draft = ComposerDraft()
        draft.text = "And then open the PR."
        draft.submit(whileTurnInFlight: true) { _, _ in }

        let mustDrop = draft.mustDropQueue(afterInterrupt: false)

        #expect(!mustDrop)
    }

    /// The one case the record cannot settle: a follow-up typed AFTER Argo's own Stop, while the
    /// status still read `running` because the record had not caught up. The boundary that then
    /// arrives IS that Stop, already answered at the click — so what is waiting now is the
    /// reader's intent for what comes next, and it is released rather than destroyed.
    @Test
    func `a follow-up typed after Argo's own Stop is released, not dropped`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        draft.stopped { try driver.interrupt("session-a") }
        draft.text = "Actually, do the caption first."
        draft.submit(whileTurnInFlight: true) { text, _ in try driver.send(text, to: "session-a") }

        let mustDrop = draft.mustDropQueue(afterInterrupt: true)
        #expect(!mustDrop)
        draft.putNext { text, _ in try driver.send(text, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["Actually, do the caption first."])
    }

    /// The claim is spent by ANY boundary, not only the one it was made for: a Stop whose
    /// interrupt the record somehow never reports must not go on swallowing the next one's drop.
    @Test
    func `one Stop answers one boundary and no more`() {
        var draft = ComposerDraft()
        draft.stopped {}

        let answersItsOwn = draft.mustDropQueue(afterInterrupt: true)
        let answersTheNext = draft.mustDropQueue(afterInterrupt: true)

        #expect(!answersItsOwn)
        #expect(answersTheNext)
    }
}
