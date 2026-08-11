import ArgoEngine
import Foundation

/// What the field holds, what is waiting behind it, and why the last attempt to send did not go.
/// Also what the per-Session store (`ComposerDrafts`) keeps.
struct ComposerDraft: Equatable {
    var text: String
    /// Why the last send was refused, and `nil` the moment one goes through.
    private(set) var refusal: String?
    /// The follow-ups typed while a Turn was running, oldest first — they are sent in the order
    /// they were typed.
    private(set) var queued: [QueuedTurn]
    /// When the field was last typed in, as the roster spells a time; `nil` for a draft nobody has
    /// touched.
    var editedAtMs: Int?

    init(
        text: String = "",
        refusal: String? = nil,
        queued: [QueuedTurn] = [],
        editedAtMs: Int? = nil,
    ) {
        self.text = text
        self.refusal = refusal
        self.queued = queued
        self.editedAtMs = editedAtMs
    }

    /// Whether there is anything to send, by the port's own rule.
    var isSendable: Bool {
        SessionTurn.isSendable(text)
    }

    /// Whether this draft holds anything at all — words, a follow-up, or an unseen refusal. What
    /// the store keys eviction on.
    var isEmpty: Bool {
        text.isEmpty && queued.isEmpty && refusal == nil
    }

    /// Put the draft to the Session through `deliver`. A refusal keeps every character where it
    /// was typed — a failed send must never clear the field.
    mutating func send(via deliver: (String) throws -> Void) {
        refusal = Self.refusal(putting: text, via: deliver)
        guard refusal == nil else { return }
        text = ""
    }

    /// The one way a Turn leaves the field: it goes now if the Session is free and waits if it is
    /// not. Guarded here rather than in the driver — Return lands here from an empty field too,
    /// and a bare Return at a live prompt must never leak.
    mutating func submit(whileRunning isRunning: Bool, via deliver: (String) throws -> Void) {
        guard isSendable else { return }
        guard isRunning else { return send(via: deliver) }
        queued.append(QueuedTurn(text: text))
        text = ""
        refusal = nil
    }

    /// Deliver what was waiting, oldest first, when the Turn it was waiting on ends. A refusal
    /// stops the run where it happened — the turns it never reached stay queued.
    mutating func flush(via deliver: (String) throws -> Void) {
        guard !queued.isEmpty else { return }
        while let next = queued.first {
            if let refused = Self.refusal(putting: next.text, via: deliver) {
                return refusal = refused
            }
            queued.removeFirst()
            refusal = nil
        }
    }

    /// Take one waiting follow-up back — the chip's `×`. By id and never by text: two identical
    /// follow-ups are two things.
    mutating func cancel(_ turn: QueuedTurn.ID) {
        queued.removeAll { $0.id == turn }
    }

    /// What the seam's Retry puts back: whatever the standing refusal actually stopped. The QUEUE
    /// first — a refused flush is the one way a refusal comes to stand over an EMPTY field.
    mutating func retry(via deliver: (String) throws -> Void) {
        guard queued.isEmpty else { return flush(via: deliver) }
        guard isSendable else { return }
        send(via: deliver)
    }

    /// Why `deliver` would not take these words, and `nil` when it did — the one place a thrown
    /// error becomes a sentence.
    private static func refusal(
        putting text: String,
        via deliver: (String) throws -> Void,
    )
        -> String? {
        do {
            try deliver(text)
            return nil
        } catch let refused as SessionDriveError {
            return refused.detail
        } catch {
            return error.localizedDescription
        }
    }
}
