import ArgoEngine
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

    @Test
    func `stopping a Turn clears the field and the tray`() {
        var draft = ComposerDraft(
            text: "No, not that file —",
            attachments: [AttachmentFixture.pasted],
        )

        draft.stopped {}

        #expect(draft.text.isEmpty)
        #expect(draft.attachments.isEmpty)
    }

    /// Cleared, and SAID so. Everywhere else in this value a message survives what went wrong with
    /// it; this is the one act that cannot let it, so a reader who typed something is told where it
    /// went rather than finding an empty vessel.
    @Test
    func `what the interrupt cleared is reported on the seam`() {
        var draft = ComposerDraft(text: "No, not that file —")

        draft.stopped {}

        #expect(draft.notice == ComposerDraft.cleared)
        #expect(ComposerSeamNote.note(for: draft, enteredAtMs: 0)
            == .notice(ComposerSeamLine(ComposerDraft.cleared)))
    }

    /// Stopping with nothing in the vessel says nothing. The control is live for the whole of a run
    /// and the empty composer is the commonest state to stop from — a line reporting that an empty
    /// field was emptied is a seam that cries wolf every time.
    @Test
    func `stopping an empty composer leaves no note`() {
        var draft = ComposerDraft()

        draft.stopped {}

        #expect(draft.notice == nil)
        #expect(draft.isEmpty)
    }

    /// A refusal the reader has not answered yet goes with the rest: it stood over a message that
    /// is no longer there, and a reason with nothing left to explain is a warning about nothing.
    @Test
    func `stopping clears a standing refusal along with the words it stood over`() {
        var draft = ComposerDraft(
            text: "Carry on with the plan.",
            refusal: SessionDriveError.notDrivable.detail,
        )

        draft.stopped {}

        #expect(draft.refusal == nil)
        #expect(draft.notice == ComposerDraft.cleared)
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
    @Test
    func `the interrupt reads as a mark in the feed, never as a prompt`() {
        let rows = FeedProjection.rows(from: [
            .prompt(text: "Fix the caption.", images: [], atMs: 0),
            .prompt(text: ClaudeInterrupt.mark, images: [], atMs: 1),
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
