import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation
import Testing

/// A Turn the CLI never heard, coming back to the field it was typed in (#682).
///
/// The composer clears on the strength of keystrokes having been WRITTEN, which is the only thing
/// the send can know at the moment it returns. Whether they were read is answered seconds later by
/// the CLI's own record, so this is the news arriving late — and the words are the whole of it.
@Suite("Composer lost turn")
@MainActor
struct ComposerLostTurnTests {
    @Test
    func `the words come back into a field the reader has left empty`() {
        var draft = ComposerDraft()

        draft.turnLost("what is @README.md about?", whileRunning: false)

        #expect(draft.text == "what is @README.md about?")
        #expect(draft.notice == ComposerDraft.lost)
    }

    /// Decision 8's rule read at this act: a reader who has started the next message must not have
    /// it typed over. The line still says the Turn is gone, and those words are theirs to send.
    @Test
    func `a field the reader is already using is left exactly as it is`() {
        var draft = ComposerDraft(text: "Something else entirely")

        draft.turnLost("what is @README.md about?", whileRunning: false)

        #expect(draft.text == "Something else entirely")
        #expect(draft.notice == ComposerDraft.lost)
    }

    /// A tray with something on it is a Turn under way, so it counts as a field in use — putting
    /// words above those chips would build a message out of two different intentions.
    @Test
    func `a tray with attachments on it counts as a field in use`() {
        var draft = ComposerDraft(attachments: [Self.dropped])

        draft.turnLost("what is @README.md about?", whileRunning: false)

        #expect(draft.text.isEmpty)
        #expect(draft.notice == ComposerDraft.lost)
    }

    /// Told twice, a reader must not have the same Turn put back on top of itself. The field it
    /// filled is what refuses the second one, not the standing notice (#1183).
    @Test
    func `the same lost Turn is not put back on top of itself`() {
        var draft = ComposerDraft()

        draft.turnLost("Off you go.", whileRunning: false)
        draft.turnLost("Off you go.", whileRunning: false)

        #expect(draft.text == "Off you go.")
    }

    /// A second, genuinely new lost Turn is news of its own: whether the field is free is the
    /// only question a standing notice does not answer.
    @Test
    func `a second lost Turn reports into a field the reader has since emptied`() {
        var draft = ComposerDraft()
        draft.turnLost("Off you go.", whileRunning: false)

        draft.text = ""
        draft.turnLost("And again.", whileRunning: false)

        #expect(draft.text == "And again.")
        #expect(draft.notice == ComposerDraft.lost)
    }

    /// The bug the watch's re-key blindness produced (#1176): the Turn landed, the feed is drawing
    /// it running, and the news that it was lost is simply wrong. Spent without a word — a restore
    /// here would put the sentence back directly below the sentence being answered.
    @Test
    func `a Turn the feed is drawing running puts nothing back`() {
        var draft = ComposerDraft()

        draft.turnLost("what is @README.md about?", whileRunning: true)

        #expect(draft.text.isEmpty)
        #expect(draft.notice == nil)
    }

    /// The seam is one line, and a refusal outranks this: a refusal stands over words that are
    /// still unsent, which is the sharper thing to say about the same field.
    @Test
    func `the lost note reads as a notice on the seam`() {
        var draft = ComposerDraft()
        draft.turnLost("Off you go.", whileRunning: false)

        let note = ComposerSeamNote.note(for: draft, enteredAtMs: 0)

        #expect(note == .notice(ComposerSeamLine(ComposerDraft.lost)))
    }

    private static var dropped: SessionAttachment {
        SessionAttachment(
            name: "notes.md",
            byteCount: 2048,
            isImage: false,
            source: .file(URL(filePath: "/argo/notes.md")),
        )
    }
}
