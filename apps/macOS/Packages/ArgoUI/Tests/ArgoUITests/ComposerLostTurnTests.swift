import ArgoEngine
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

        let told = draft.turnLost("what is @README.md about?")

        #expect(told)
        #expect(draft.text == "what is @README.md about?")
        #expect(draft.notice == ComposerDraft.lost)
    }

    /// Decision 8's rule read at this act: a reader who has started the next message must not have
    /// it typed over. The line still says the Turn is gone, and those words are theirs to send.
    @Test
    func `a field the reader is already using is left exactly as it is`() {
        var draft = ComposerDraft(text: "Something else entirely")

        let told = draft.turnLost("what is @README.md about?")

        #expect(told)
        #expect(draft.text == "Something else entirely")
        #expect(draft.notice == ComposerDraft.lost)
    }

    /// A tray with something on it is a Turn under way, so it counts as a field in use — putting
    /// words above those chips would build a message out of two different intentions.
    @Test
    func `a tray with attachments on it counts as a field in use`() {
        var draft = ComposerDraft(attachments: [Self.dropped])

        let told = draft.turnLost("what is @README.md about?")

        #expect(told)
        #expect(draft.text.isEmpty)
        #expect(draft.notice == ComposerDraft.lost)
    }

    /// The news is spent once it has been taken in. Told twice, a reader would put the same Turn
    /// back twice — and the second one would land on the field the first one filled.
    @Test
    func `the same lost Turn is not put back a second time`() {
        var draft = ComposerDraft()

        let told = draft.turnLost("Off you go.")
        draft.text = ""
        let toldAgain = draft.turnLost("Off you go.")

        #expect(told)
        #expect(!toldAgain)
        #expect(draft.text.isEmpty)
    }

    /// The seam is one line, and a refusal outranks this: a refusal stands over words that are
    /// still unsent, which is the sharper thing to say about the same field.
    @Test
    func `the lost note reads as a notice on the seam`() {
        var draft = ComposerDraft()
        _ = draft.turnLost("Off you go.")

        let note = ComposerSeamNote.note(for: draft, enteredAtMs: 0)

        #expect(note == .notice(ComposerDraft.lost))
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
