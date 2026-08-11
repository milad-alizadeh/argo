import ArgoEngine
import Foundation

/// What the field holds, what is waiting behind it, and why the last attempt to send did not go.
///
/// A value beside the view rather than state inside it, so the composer's rules — a sent draft
/// clears, a refused one stays put with the reason, a follow-up typed mid-run waits its turn — are
/// claims a test can make against the port's own fake instead of against renders nobody diffs.
///
/// It is also what the per-Session store keeps (`ComposerDrafts`), which is why the whole of a
/// composer's memory is here and not spread across the view: a draft that survived switching
/// Session and the queue behind it travel as one thing or they arrive back out of step.
struct ComposerDraft: Equatable {
    var text: String
    /// Why the last send was refused, in the seam's words — and `nil` the moment one goes
    /// through, because a reason standing over a message that was delivered is a warning about
    /// nothing.
    private(set) var refusal: String?
    /// The follow-ups typed while a Turn was running, oldest first. Order is the whole contract:
    /// they are sent in the order they were typed, because two instructions in the wrong order are
    /// a different instruction.
    private(set) var queued: [QueuedTurn]
    /// When the field was last typed in, as the roster spells a time — and what the seam's
    /// "kept from" is measured back from. `nil` for a draft nobody has touched, which is also a
    /// draft there is nothing to say was kept.
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

    /// Whether there is anything to send — the port's own rule, so the disabled control and the
    /// driver's refusal cannot disagree about what an empty message is.
    var isSendable: Bool {
        SessionTurn.isSendable(text)
    }

    /// Put the draft to the Session through `deliver`. A refusal keeps every character where it
    /// was typed and says why — a failed send must never clear the field.
    mutating func send(via deliver: (String) throws -> Void) {
        do {
            try deliver(text)
            text = ""
            refusal = nil
        } catch let refused as SessionDriveError {
            refusal = refused.detail
        } catch {
            refusal = error.localizedDescription
        }
    }

    /// The one way a Turn leaves the field. It goes now if the Session is free and waits if it is
    /// not, so nothing above this has to know which of the two it is asking for.
    ///
    /// Guarded rather than left to the driver: Return lands here from an empty field too, and a
    /// bare Return at a live prompt is the one keystroke the composer must never leak.
    mutating func submit(whileRunning isRunning: Bool, via deliver: (String) throws -> Void) {
        guard isSendable else { return }
        guard isRunning else { return send(via: deliver) }
        queued.append(QueuedTurn(text: text))
        text = ""
        refusal = nil
    }

    /// Deliver what was waiting, oldest first, when the Turn it was waiting on ends.
    ///
    /// A refusal stops the run where it happened: the turns it never reached stay queued, because
    /// a Session that has just said it cannot take a message will not take the next three either,
    /// and emptying the queue into that refusal would lose them silently.
    mutating func flush(via deliver: (String) throws -> Void) {
        guard !queued.isEmpty else { return }
        while let next = queued.first {
            var attempt = ComposerDraft(text: next.text)
            attempt.send(via: deliver)
            guard attempt.refusal == nil else { return refusal = attempt.refusal }
            queued.removeFirst()
            refusal = nil
        }
    }

    /// Take one waiting follow-up back — the chip's `×`. By id and never by text: two identical
    /// follow-ups are two things, and the one the user pointed at is the one that goes.
    mutating func cancel(_ turn: QueuedTurn.ID) {
        queued.removeAll { $0.id == turn }
    }
}
