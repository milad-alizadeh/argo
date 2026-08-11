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
        now: @escaping () -> Int = WallClock.nowMs,
    ) {
        self.drafts = drafts
        self.now = now
    }

    /// What a Session is holding, and an empty draft for one that has never been typed in — never
    /// `nil`, because the field is always there to type into and a caller unwrapping an absence
    /// would be asking a different question.
    subscript(sessionID: String) -> ComposerDraft {
        get { drafts[sessionID] ?? ComposerDraft() }
        // A draft holding nothing is dropped rather than kept as an entry, so the store grows with
        // what people actually typed and not with every Session they clicked on. Reading one back
        // gives an empty draft either way, which is why the absence costs nothing.
        set {
            let stamped = stamped(newValue, against: drafts[sessionID])
            drafts[sessionID] = stamped.isEmpty ? nil : stamped
        }
    }

    /// Whether any Session is holding anything at all. Read by the tests that prove an empty draft
    /// leaves no entry behind — the store keeps what people typed, not every Session they clicked.
    var isEmpty: Bool {
        drafts.isEmpty
    }

    /// The binding the vessel writes through, so the store is the only thing that stamps a time.
    func binding(for sessionID: String) -> Binding<ComposerDraft> {
        Binding(get: { self[sessionID] }, set: { self[sessionID] = $0 })
    }

    /// The stamp follows the TEXT, and nothing else about the draft.
    ///
    /// What this exists for is the refusal: a failed send leaves every character where it was
    /// typed (design decision 8), and moving the clock for it would make an hour-old draft read as
    /// one written just now, on the strength of an attempt that changed nothing. A send or a queue
    /// that goes through DOES move it, because clearing the field is a change to the text — and
    /// harmlessly, since the seam only ever speaks over a draft with words still in it.
    private func stamped(_ draft: ComposerDraft, against was: ComposerDraft?) -> ComposerDraft {
        guard draft.text != (was?.text ?? "") else { return draft }
        var stamped = draft
        stamped.editedAtMs = now()
        return stamped
    }
}
