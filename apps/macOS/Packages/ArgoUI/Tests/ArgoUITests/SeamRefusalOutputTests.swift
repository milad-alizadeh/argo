import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Which of the composer seam's sentences put unabridged output one gesture behind them (§5 of
/// `cockpit-failure-states-spec.md`), and which are a sentence Argo worded itself with nothing
/// behind it to open (#1045).
@Suite("Composer seam output")
struct SeamRefusalOutputTests {
    /// Something thrown at the composer that Argo did not word: more than one line, because that is
    /// the length nothing in Argo controls once the words are somebody else's.
    struct PortRefusal: LocalizedError {
        var errorDescription: String? {
            """
            The adapter would not take that Turn.
            hint: it was still writing the last one
            """
        }
    }

    static let firstLine = "The adapter would not take that Turn."

    @Test
    func `a refusal Argo did not word carries every word of it`() {
        var draft = ComposerDraft(text: "Carry on.")
        draft.send(via: { _, _ in throw PortRefusal() })

        #expect(draft.refusal == Self.firstLine)
        #expect(draft.refusalOutput?.text.contains("hint: it was still writing") == true)
    }

    /// The tooltip's one surviving case: `SessionDriveError.detail` is Argo's own line, and short
    /// enough to sit on one by that type's own contract.
    @Test
    func `a refusal Argo worded itself carries no output`() {
        var draft = ComposerDraft(text: "Carry on.")
        draft.send(via: { _, _ in throw SessionDriveError.notDrivable })

        #expect(draft.refusal == SessionDriveError.notDrivable.detail)
        #expect(draft.refusalOutput == nil)
    }

    @Test
    func `a stopped Turn the port refused carries what it printed`() {
        var draft = ComposerDraft(text: "Carry on.")
        draft.stopped(via: { throw PortRefusal() })

        #expect(draft.refusal == Self.firstLine)
        #expect(draft.refusalOutput?.text.contains("hint: it was still writing") == true)
    }

    @Test
    func `a rung the port refused in its own words carries them`() {
        var draft = ComposerDraft()
        draft.modeRefused(PortRefusal())

        #expect(draft.notice == Self.firstLine)
        #expect(draft.noticeOutput?.text.contains("hint: it was still writing") == true)
    }

    /// Every notice Argo writes for this seam is Argo's own sentence about the draft.
    @Test
    func `a notice Argo wrote itself carries no output`() {
        var draft = ComposerDraft(text: "Carry on.")
        draft.modeRefused(SessionDriveError.modeUnreachable)
        #expect(draft.noticeOutput == nil)

        draft.attach([], canAttach: false)
        draft.modeHeld(.auto)
        #expect(draft.noticeOutput == nil)

        let told = draft.turnLost("Carry on.")
        #expect(told)
        #expect(draft.noticeOutput == nil)
    }

    @Test
    func `the seam offers the output of the sentence it is showing`() {
        var draft = ComposerDraft(text: "Carry on.")
        // A rung the port refused in its own words, then a send Argo refused in its own — the
        // refusal outranks the notice, so the line on the seam has nothing behind it.
        draft.modeRefused(PortRefusal())
        draft.send(via: { _, _ in throw SessionDriveError.notDrivable })
        let note = ComposerSeamNote.note(for: draft, enteredAtMs: 0)

        #expect(note?.detail == SessionDriveError.notDrivable.detail)
        #expect(note?.output == nil)
    }

    @Test
    func `a kept draft has nothing to open`() {
        let draft = ComposerDraft(text: "Carry on.", editedAtMs: 0)
        let note = ComposerSeamNote.note(for: draft, enteredAtMs: 60000)

        #expect(note?.output == nil)
    }

    /// A rung the CLI contradicted is Argo's reading of its own picker, not a port's answer.
    @Test
    func `a rung that did not take has nothing to open`() {
        let note = ComposerSeamNote.note(
            for: ComposerDraft(),
            enteredAtMs: 0,
            modeDidNotTake: .auto,
        )

        #expect(note?.output == nil)
    }
}
