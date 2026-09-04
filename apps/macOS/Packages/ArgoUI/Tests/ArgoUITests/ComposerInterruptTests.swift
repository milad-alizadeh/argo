import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// Stopping a Turn from the composer (#541): what the vessel is left holding afterwards, and how
/// the interrupt reads in the feed once the record catches up.
@Suite("Composer interrupt")
@MainActor
struct ComposerInterruptTests {
    /// The queue is the half that would bite. A follow-up waiting on a Turn is released the moment
    /// that Turn ends, and an interrupt IS it ending — so without the clearing, the very next thing
    /// the Session received would be instructions written for the run somebody just killed.
    @Test
    func `stopping a Turn takes the queued follow-ups with it`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        for text in ["And then open the PR.", "Then tell me what moved."] {
            draft.text = text
            draft.submit(whileRunning: true) { text, _ in try driver.send(text, to: "session-a") }
        }

        draft.stopped {}
        // The flush the vessel runs when the Session goes idle, which is what the clearing has to
        // get in front of.
        draft.flush { text, _ in try driver.send(text, to: "session-a") }

        #expect(draft.queued.isEmpty)
        #expect(driver.sent(to: "session-a").isEmpty)
    }

    /// The field and the tray are the reader's, and Stop is not a delete key. Words never handed
    /// over are not released by the Turn ending, so there is nothing here to take back — and
    /// stopping in order to say something else is the commonest reason to reach for the control at
    /// all.
    @Test
    func `stopping a Turn leaves the field and the tray exactly as they were`() {
        // Held rather than read twice: the fixture mints an id per access, so a second read is a
        // different attachment and the claim would fail on the identity rather than on the act.
        let chip = AttachmentFixture.pasted
        var draft = ComposerDraft(text: "No, not that file —", attachments: [chip])

        draft.stopped {}

        #expect(draft.text == "No, not that file —")
        #expect(draft.attachments == [chip])
    }

    /// Dropped, and SAID so. A follow-up is the one thing an interrupt destroys, so a reader who
    /// queued one is told where it went rather than watching the chip vanish.
    @Test
    func `what the interrupt dropped is reported on the seam`() {
        var draft = ComposerDraft(text: "And then open the PR.")
        draft.submit(whileRunning: true) { _, _ in }

        draft.stopped {}

        #expect(draft.notice == ComposerDraft.droppedQueue)
        #expect(ComposerSeamNote.note(for: draft, enteredAtMs: 0)
            == .notice(ComposerSeamLine(ComposerDraft.droppedQueue)))
    }

    /// Stopping with nothing queued says nothing. The control is live for the whole of a run and
    /// the empty queue is the commonest state to stop from — a line reporting that nothing was
    /// dropped is a seam that cries wolf every time.
    @Test
    func `stopping with nothing queued leaves no note`() {
        var draft = ComposerDraft(text: "Carry on with the plan.")

        draft.stopped {}

        #expect(draft.notice == nil)
        #expect(draft.text == "Carry on with the plan.")
    }

    /// A landed Stop takes the standing refusal down, whatever it stood over — and the seam's
    /// RETRY is the reason rather than housekeeping (#1189). After the act the queue is empty, so
    /// `retry(via:)` falls through to the FIELD: a reader pressing a button that means "try that
    /// again" would send the words they are still typing as a fresh Turn nobody asked for. Left
    /// standing it also outranks the drop's own notice, so the one line the reader needs — that
    /// the follow-ups went — is never drawn.
    @Test
    func `a landed Stop takes down the refusal standing over the field`() {
        var draft = ComposerDraft(
            text: "Carry on with the plan.",
            refusal: SessionDriveError.notDrivable.detail,
        )

        draft.stopped {}

        #expect(draft.refusal == nil)
        #expect(draft.text == "Carry on with the plan.")
    }

    /// The same at the act that produces the trap: a first Stop refused, a second that lands. The
    /// reason the first put up is answered by the second, and a queue it never had cannot be what
    /// clears it.
    @Test
    func `a Stop that lands answers the refusal a refused Stop left`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        var draft = ComposerDraft(text: "Stop, stop.")
        draft.stopped { try driver.interrupt("session-a") }
        #expect(draft.refusal == SessionDriveError.notDrivable.detail)

        driver.refusal = nil
        draft.stopped { try driver.interrupt("session-a") }

        #expect(draft.refusal == nil)
        #expect(draft.text == "Stop, stop.")
    }

    /// A stop that never landed stopped nothing, so it may clear nothing. The vessel would
    /// otherwise empty itself on the strength of having ASKED, and post a line claiming a Turn was
    /// stopped that is still running — decision 8's rule, at the other act.
    @Test
    func `a refused interrupt clears nothing and says why`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        var draft = ComposerDraft(text: "No, not that file —")
        draft.submit(whileRunning: true) { _, _ in }
        draft.text = "Stop, stop."

        draft.stopped { try driver.interrupt("session-a") }

        #expect(draft.text == "Stop, stop.")
        #expect(draft.queued.map(\.text) == ["No, not that file —"])
        #expect(draft.refusal == SessionDriveError.notDrivable.detail)
        #expect(draft.notice == nil)
    }

    /// The record files the interrupt on the USER side, so read as written it would be a row in the
    /// reader's own voice saying something they never typed. It is punctuation instead.
    ///
    /// The marker is read into `.interrupted` upstream, by the engine (#1189) — the feed is handed
    /// the boundary rather than the sentence, and never sees a prompt to test here.
    @Test
    func `the interrupt reads as a mark in the feed, never as a prompt`() {
        let rows = FeedProjection.rows(from: [
            .prompt(text: "Fix the caption.", images: [], atMs: 0),
            .interrupted(atMs: 1),
        ])

        #expect(rows.map(\.content) == [
            .prompt(text: "Fix the caption.", shots: []),
            .mark(.interrupted),
        ])
    }

    /// A reader quoting the marker in a message of their own gets their message back. The whole
    /// entry has to BE the sentence, or the feed would cut somebody's paragraph in half with a
    /// rule.
    @Test
    func `a prompt that merely quotes the marker stays a prompt`() {
        let quoted = "Why does \(ClaudeInterrupt.mark) show up twice in the log?"

        let rows = FeedProjection.rows(from: [.prompt(text: quoted, images: [], atMs: 0)])

        #expect(rows.map(\.content) == [.prompt(text: quoted, shots: [])])
    }
}
