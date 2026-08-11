import Observation
import SwiftUI

/// Every Session's unsent words, kept while the cockpit points somewhere else.
///
/// The composer is a place to think, and thinking survives being interrupted: a user who switches
/// to another Session to check something and comes back finds the half-written turn where they
/// left it, with the queue behind it intact. State inside the vessel could not do this — the view
/// is rebuilt per Session, and a draft held there leaves with the selection.
///
/// **In memory only, and deliberately.** It keeps a draft across a switch, not across a restart:
/// what the composer holds is unsent, and unsent words restored into a Session whose PTY died with
/// the process would be a message about to be put to something that is no longer there.
@Observable
final class ComposerDrafts {
    private var drafts: [String: ComposerDraft]
    /// The wall clock, as milliseconds since the epoch — injected so the "kept from" a test asserts
    /// on is a number it chose rather than whenever the suite happened to run.
    @ObservationIgnored private let now: () -> Int

    init(
        drafts: [String: ComposerDraft] = [:],
        now: @escaping () -> Int = { Int(Date().timeIntervalSince1970 * 1000) },
    ) {
        self.drafts = drafts
        self.now = now
    }

    /// What a Session is holding, and an empty draft for one that has never been typed in — never
    /// `nil`, because the field is always there to type into and a caller unwrapping an absence
    /// would be asking a different question.
    subscript(sessionID: String) -> ComposerDraft {
        get { drafts[sessionID] ?? ComposerDraft() }
        set { drafts[sessionID] = stamped(newValue, against: drafts[sessionID]) }
    }

    /// The binding the vessel writes through, so the store is the only thing that stamps a time.
    func binding(for sessionID: String) -> Binding<ComposerDraft> {
        Binding(get: { self[sessionID] }, set: { self[sessionID] = $0 })
    }

    /// Stamp the moment the TEXT changed, and only that. A draft rewritten by a send, a queued
    /// follow-up or a refusal is not the user typing, so it must not restart the clock the seam
    /// counts back from — otherwise a draft the user left an hour ago reads as one they just wrote
    /// the instant anything else about it moves.
    private func stamped(_ draft: ComposerDraft, against was: ComposerDraft?) -> ComposerDraft {
        guard draft.text != (was?.text ?? "") else { return draft }
        var stamped = draft
        stamped.editedAtMs = now()
        return stamped
    }
}
