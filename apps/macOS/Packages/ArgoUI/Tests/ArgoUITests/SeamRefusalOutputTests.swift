import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// Which of the composer seam's sentences put unabridged output one gesture behind them (§5 of
/// `cockpit-failure-states-spec.md`), and which are a sentence Argo worded itself with nothing
/// behind it to open (#1045).
@Suite("Composer seam output")
struct SeamRefusalOutputTests {
    /// The specimen's own refusal, so these claims and the render are made of the same words.
    typealias PortRefusal = ComposerSpecimen.PortRefusal

    static let firstLine = "The adapter would not take that Turn."
    static let hint = "hint: the last one is still being written"

    @Test
    func `a refusal Argo did not word says the port's first line`() {
        var draft = ComposerDraft(text: "Carry on.")
        draft.send(via: { _, _ in throw PortRefusal() })

        #expect(draft.refusal == Self.firstLine)
    }

    @Test
    func `a refusal Argo did not word keeps every word of it`() {
        var draft = ComposerDraft(text: "Carry on.")
        draft.send(via: { _, _ in throw PortRefusal() })

        #expect(draft.refusalOutput?.text == PortRefusal().errorDescription)
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
        #expect(draft.refusalOutput?.text.contains(Self.hint) == true)
    }

    @Test
    func `a rung the port refused in its own words carries them`() {
        var draft = ComposerDraft()
        draft.modeRefused(PortRefusal())

        #expect(draft.notice == Self.firstLine)
        #expect(draft.noticeOutput?.text.contains(Self.hint) == true)
    }

    /// One act that puts a sentence on the seam, named so a failure says which.
    struct Notice: CustomTestStringConvertible, Sendable {
        let name: String
        let said: @Sendable (inout ComposerDraft) -> Void

        var testDescription: String {
            name
        }
    }

    /// Every notice Argo writes for this seam is Argo's own sentence about the draft, so not one
    /// of the four acts that raise one leaves anything to open.
    @Test(arguments: [
        Notice(name: "a rung Argo could not establish", said: {
            $0.modeRefused(SessionDriveError.modeUnreachable)
        }),
        Notice(name: "a drop the adapter takes none of", said: {
            $0.attach([AttachmentFixture.pasted], canAttach: false)
        }),
        Notice(name: "a rung held for the boundary", said: { $0.modeHeld(.auto) }),
        Notice(
            name: "a Turn the CLI never heard",
            said: { _ = $0.turnLost("Carry on.", whileRunning: false) },
        ),
    ])
    func `a notice Argo wrote itself carries no output`(notice: Notice) {
        var draft = ComposerDraft(text: "Carry on.")
        notice.said(&draft)

        #expect(draft.notice != nil)
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
