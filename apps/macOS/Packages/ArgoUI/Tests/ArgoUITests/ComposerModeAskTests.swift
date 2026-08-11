import ArgoEngine
@testable import ArgoUI
import Testing

/// Asking a Session for a rung from the composer (#545): what the vessel is left holding when the
/// port refuses, and what it says.
@Suite("Composer mode ask")
struct ComposerModeAskTests {
    /// The one thing a refusal must not do. The control draws the Session's own reading, so a rung
    /// that never landed is already back where it was — but the words beside it were never at risk
    /// and must stay exactly where they were typed.
    @Test
    func `a refused rung leaves the draft untouched`() {
        var draft = ComposerDraft(text: "Carry on with the plan.")

        draft.modeAsked { throw SessionDriveError.modeBusy }

        #expect(draft.text == "Carry on with the plan.")
        #expect(draft.refusal == nil)
    }

    /// A notice and not a refusal, for the reason `cannotAttach` is one: nothing is unsent, so a
    /// Retry would have nothing to put back — and Retry is what a refusal draws.
    @Test(arguments: [SessionDriveError.modeBusy, .modeUnreachable, .notDrivable])
    func `the port's own reason reaches the seam as a notice`(refused: SessionDriveError) {
        var draft = ComposerDraft()

        draft.modeAsked { throw refused }

        #expect(draft.notice == refused.detail)
        #expect(ComposerSeamNote.note(for: draft, enteredAtMs: 0) == .notice(refused.detail))
    }

    @Test
    func `a rung that landed says nothing at all`() {
        var draft = ComposerDraft(notice: ComposerDraft.cleared)

        draft.modeAsked {}

        #expect(draft.notice == nil)
        #expect(ComposerSeamNote.note(for: draft, enteredAtMs: 0) == nil)
    }
}
