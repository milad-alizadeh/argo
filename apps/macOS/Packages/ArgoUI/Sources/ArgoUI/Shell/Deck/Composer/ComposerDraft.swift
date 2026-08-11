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
/// How a Turn leaves the composer: the words, and whatever was on the tray with them.
///
/// One closure and not two, because they are one act — the paths are named INSIDE the Turn the
/// words are in (`SessionTurn.text(_:attaching:)`), so an attach that went and a send that did not
/// would leave files written for a message nobody sent.
typealias ComposerSend = (String, [SessionAttachment]) throws -> Void

struct ComposerDraft: Equatable {
    var text: String
    /// What is on the tray above the field, in the order it was given (#540). The order is the
    /// contract: it is the order the Turn names the paths in.
    ///
    /// Not `private(set)` like its neighbours, and not an omission: the rules that mutate it are in
    /// `ComposerDraft+Attachments.swift`, and Swift's `private` is file-scoped — the two halves of
    /// one value are in two files because one file would be over the house line ceiling.
    var attachments: [SessionAttachment]
    /// What Argo did to this draft that the reader did not do themselves, in the seam's words — a
    /// drop the adapter would not take (#540), or the clearing an interrupt leaves behind (#541).
    /// Quieter than `refusal` and outranked by it: neither is a send that failed, and the words the
    /// reader is looking at are not at risk from either.
    var notice: String?
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
        attachments: [SessionAttachment] = [],
        notice: String? = nil,
    ) {
        self.text = text
        self.refusal = refusal
        self.queued = queued
        self.editedAtMs = editedAtMs
        self.attachments = attachments
        self.notice = notice
    }

    /// Whether there is anything to send — the port's own rule, so the disabled control and the
    /// driver's refusal cannot disagree about what an empty message is.
    ///
    /// A tray with something on it IS a Turn, with no words at all: what goes is the paths, and
    /// handing the agent a file is a complete thing to have said.
    var isSendable: Bool {
        SessionTurn.isSendable(text) || !attachments.isEmpty
    }

    /// Whether this draft is holding anything at all — words, an attachment, a follow-up, or a
    /// reason the reader has not seen yet. What the store keys eviction on, so a Session clicked
    /// through and never typed into leaves nothing behind.
    var isEmpty: Bool {
        text.isEmpty && queued.isEmpty && attachments.isEmpty && refusal == nil && notice == nil
    }

    /// Put the draft to the Session through `deliver`. A refusal keeps every character where it
    /// was typed — and every chip where it was dropped — and says why: a failed send must never
    /// clear the field.
    mutating func send(via deliver: ComposerSend) {
        refusal = Self.refusal(putting: text, attaching: attachments, via: deliver)
        guard refusal == nil else { return }
        text = ""
        attachments = []
        notice = nil
    }

    /// The one way a Turn leaves the field. It goes now if the Session is free and waits if it is
    /// not, so nothing above this has to know which of the two it is asking for.
    ///
    /// Guarded rather than left to the driver: Return lands here from an empty field too, and a
    /// bare Return at a live prompt is the one keystroke the composer must never leak.
    mutating func submit(whileRunning isRunning: Bool, via deliver: ComposerSend) {
        guard isSendable else { return }
        guard isRunning else { return send(via: deliver) }
        queued.append(QueuedTurn(text: text, attachments: attachments))
        text = ""
        attachments = []
        refusal = nil
        notice = nil
    }

    /// Deliver what was waiting, oldest first, when the Turn it was waiting on ends.
    ///
    /// A refusal stops the run where it happened: the turns it never reached stay queued, because
    /// a Session that has just said it cannot take a message will not take the next three either,
    /// and emptying the queue into that refusal would lose them silently.
    mutating func flush(via deliver: ComposerSend) {
        guard !queued.isEmpty else { return }
        while let next = queued.first {
            if let refused = Self.refusal(
                putting: next.text,
                attaching: next.attachments,
                via: deliver,
            ) {
                return refusal = refused
            }
            queued.removeFirst()
            refusal = nil
        }
    }

    /// What an interrupt leaves in the composer: nothing (#541, ADR-0024). The field, the tray and
    /// the queue all go, so no leftover word can concatenate onto the next Turn.
    ///
    /// The QUEUE is the half a reader would not think to ask about, and the half that would bite.
    /// A follow-up typed while the Turn ran is released the moment that Turn ends — and an
    /// interrupt IS it ending, so without this the very next thing the Session received would be
    /// instructions written for the run somebody had just killed.
    ///
    /// It says what it did rather than clearing quietly. Everywhere else here the rule is that a
    /// message survives what went wrong with it; this is the one act that cannot let it, so the
    /// reader is told instead of finding an empty vessel and having to guess.
    mutating func stopped() {
        guard !isEmpty else { return }
        text = ""
        attachments = []
        queued = []
        refusal = nil
        notice = Self.cleared
    }

    /// The seam's sentence for it. Named rather than written at the call site, so the test that
    /// asserts the reader was told and the vessel that tells them cannot come to disagree.
    static let cleared = "Turn stopped — the composer was cleared"

    /// Take one waiting follow-up back — the chip's `×`. By id and never by text: two identical
    /// follow-ups are two things, and the one the user pointed at is the one that goes.
    mutating func cancel(_ turn: QueuedTurn.ID) {
        queued.removeAll { $0.id == turn }
    }

    /// What the seam's Retry puts back: whatever the standing refusal actually stopped.
    ///
    /// The QUEUE first, because a refused flush is the one way a refusal comes to stand over an
    /// EMPTY field — the words went into the queue before they were ever put to the Session. A
    /// Retry that only ever read the field would be a remedy that does nothing in exactly the
    /// state that produced it.
    mutating func retry(via deliver: ComposerSend) {
        guard queued.isEmpty else { return flush(via: deliver) }
        guard isSendable else { return }
        send(via: deliver)
    }

    /// Why `deliver` would not take these words, in the seam's terms — and `nil` when it did. The
    /// one place a thrown error becomes a sentence, so a turn sent from the field and one released
    /// from the queue cannot report the same failure two different ways.
    private static func refusal(
        putting text: String,
        attaching attachments: [SessionAttachment],
        via deliver: ComposerSend,
    )
        -> String? {
        do {
            try deliver(text, attachments)
            return nil
        } catch let refused as SessionDriveError {
            return refused.detail
        } catch {
            return error.localizedDescription
        }
    }
}
