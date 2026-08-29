import Observation
import SwiftUI

/// Every Session's unsent words, kept while the cockpit points somewhere else. State inside the
/// vessel could not do this — the view is rebuilt per Session, and a draft held there leaves with
/// the selection.
///
/// **In memory only, and deliberately**: a draft survives a switch, not a restart.
///
/// `@MainActor` so `binding(for:)`'s `@Sendable` closures may capture it: a main-actor class is
/// `Sendable`.
@MainActor
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

    /// What a Session is holding, and an empty draft for one never typed in — never `nil`.
    subscript(sessionID: String) -> ComposerDraft {
        get { drafts[sessionID] ?? ComposerDraft() }
        // A draft holding nothing is dropped rather than kept as an entry, so the store grows with
        // what people typed and not with every Session they clicked on.
        set {
            let stamped = stamped(newValue, against: drafts[sessionID])
            drafts[sessionID] = stamped.isEmpty ? nil : stamped
        }
    }

    /// Whether any Session is holding anything at all.
    var isEmpty: Bool {
        drafts.isEmpty
    }

    /// The binding the vessel writes through, so the store is the only thing that stamps a time.
    func binding(for sessionID: String) -> Binding<ComposerDraft> {
        Binding(get: { self[sessionID] }, set: { self[sessionID] = $0 })
    }

    /// The stamp follows the TEXT, and nothing else about the draft: a failed send leaves every
    /// character where it was typed (design decision 8), and moving the clock for it would make an
    /// hour-old draft read as one written just now.
    private func stamped(_ draft: ComposerDraft, against was: ComposerDraft?) -> ComposerDraft {
        guard draft.text != (was?.text ?? "") else { return draft }
        var stamped = draft
        stamped.editedAtMs = now()
        return stamped
    }
}
