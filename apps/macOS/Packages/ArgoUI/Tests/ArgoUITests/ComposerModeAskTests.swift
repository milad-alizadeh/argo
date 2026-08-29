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

        draft.modeRefused(SessionDriveError.modeUnreachable)

        #expect(draft.text == "Carry on with the plan.")
        #expect(draft.refusal == nil)
    }

    /// A notice and not a refusal, for the reason `cannotAttach` is one: nothing is unsent, so a
    /// Retry would have nothing to put back — and Retry is what a refusal draws.
    @Test(arguments: [SessionDriveError.modeUnreachable, .modeWalking, .notDrivable])
    func `the port's own reason reaches the seam as a notice`(refused: SessionDriveError) {
        var draft = ComposerDraft()

        draft.modeRefused(refused)

        #expect(draft.notice == refused.detail)
        #expect(ComposerSeamNote.note(for: draft, enteredAtMs: 0) == .notice(refused.detail))
    }

    /// A rung that landed takes back only the sentence IT put up — the Turn the reader stopped is
    /// still news, and the walk landing is not what un-says it.
    @Test
    func `a rung that landed says nothing of its own`() {
        var held = ComposerDraft()
        held.modeHeld(.auto)
        var stopped = ComposerDraft(notice: ComposerDraft.cleared)

        held.modeLanded(.auto)
        stopped.modeLanded(.auto)

        #expect(held.notice == nil)
        #expect(held.heldMode == nil)
        #expect(stopped.notice == ComposerDraft.cleared)
    }
}
