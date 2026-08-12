import ArgoEngine
import Foundation

/// How a Turn leaves the composer: the words, and whatever was on the tray with them.
///
/// One closure and not two, because they are one act — the paths are named INSIDE the Turn the
/// words are in (`SessionTurn.text(_:attaching:)`), so an attach that went and a send that did not
/// would leave files written for a message nobody sent.
typealias ComposerSend = (String, [SessionAttachment]) throws -> Void

/// What the field holds, what is waiting behind it, and why the last attempt to send did not go.
/// Also what the per-Session store (`ComposerDrafts`) keeps.
struct ComposerDraft: Equatable {
    var text: String
    /// What is on the tray above the field, in the order it was given (#540). The order is the
    /// contract: it is the order the Turn names the paths in.
    ///
    /// Not `private(set)` like its neighbours: the rules that mutate it live in
    /// `ComposerDraft+Attachments.swift`, and Swift's `private` is file-scoped.
    var attachments: [SessionAttachment]
    /// What Argo did to this draft that the reader did not do — a drop the adapter would not take
    /// (#540), or the clearing an interrupt leaves behind (#541). Quieter than `refusal` and
    /// outranked by it.
    var notice: String?
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

    /// Whether there is anything to send, by the port's own rule. A tray with something on it IS a
    /// Turn, with no words at all.
    var isSendable: Bool {
        SessionTurn.isSendable(text) || !attachments.isEmpty
    }

    /// Whether this draft holds anything at all — words, an attachment, a follow-up, or an unseen
    /// refusal. What the store keys eviction on.
    var isEmpty: Bool {
        text.isEmpty && queued.isEmpty && attachments.isEmpty && refusal == nil && notice == nil
    }

    /// Put the draft to the Session through `deliver`. A refusal keeps every character where it
    /// was typed and every chip where it was dropped — a failed send must never clear the field.
    mutating func send(via deliver: ComposerSend) {
        refusal = Self.refusal(putting: text, attaching: attachments, via: deliver)
        guard refusal == nil else { return }
        text = ""
        attachments = []
        notice = nil
    }

    /// The one way a Turn leaves the field: it goes now if the Session is free and waits if it is
    /// not. Guarded here rather than in the driver — Return lands here from an empty field too,
    /// and a bare Return at a live prompt must never leak.
    mutating func submit(whileRunning isRunning: Bool, via deliver: ComposerSend) {
        guard isSendable else { return }
        guard isRunning else { return send(via: deliver) }
        queued.append(QueuedTurn(text: text, attachments: attachments))
        text = ""
        attachments = []
        refusal = nil
        notice = nil
    }

    /// Deliver what was waiting, oldest first, when the Turn it was waiting on ends. A refusal
    /// stops the run where it happened — the turns it never reached stay queued.
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
    /// A refusal clears NOTHING, which is decision 8's rule read at this act: nothing was stopped,
    /// so the reason goes on the seam and every character stays where it was typed. The composer
    /// must never report a Turn stopped on the strength of having asked — the port is the only
    /// thing that knows whether the keystroke landed, and the Session's own status is a DERIVED
    /// reading that has not caught up yet.
    mutating func stopped(via interrupt: () throws -> Void) {
        do {
            try interrupt()
        } catch let refused as SessionDriveError {
            return refusal = refused.detail
        } catch {
            return refusal = error.localizedDescription
        }
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

    /// A rung asked for, and the port's reason where it refused (#545). A notice rather than a
    /// refusal: no words are at risk, so there is nothing for the seam's Retry to put back.
    ///
    /// Given the outcome rather than the act, because the walk is `async` now (#653) and a
    /// `mutating` method cannot hold a draft open across the wait.
    mutating func modeAsked(refusedWith error: (any Error)?) {
        guard let error else {
            notice = nil
            return
        }
        notice = (error as? SessionDriveError)?.detail ?? error.localizedDescription
    }

    /// A Turn the CLI never heard, come back to the field it was typed in (#682).
    ///
    /// Given the outcome rather than the act, for the reason `modeAsked(refusedWith:)` is: the news
    /// arrives seconds after the send returned, and a `mutating` method cannot hold a draft open
    /// across that wait.
    ///
    /// The words go back only into a field the reader has not started using again — otherwise this
    /// would type over a sentence they are in the middle of, which is the one thing decision 8
    /// rules out. Where they are typing, the notice alone says the Turn is gone, and the words are
    /// theirs to send again.
    ///
    /// `true` when the news has been taken in, which is what spends it: reported twice, a reader
    /// would put the same Turn back twice.
    mutating func turnLost(_ text: String) -> Bool {
        guard notice != Self.lost else { return false }
        notice = Self.lost
        guard !isSendable else { return true }
        self.text = text
        return true
    }

    /// What the seam says about a Turn the CLI never heard. It does not offer a Retry: the words
    /// are back in the field where Send is, and a second button for the same act would be a second
    /// answer to "how do I send this".
    static let lost = "The agent never received that message — your words are back below"

    /// Take one waiting follow-up back — the chip's `×`. By id and never by text: two identical
    /// follow-ups are two things.
    mutating func cancel(_ turn: QueuedTurn.ID) {
        queued.removeAll { $0.id == turn }
    }

    /// What the seam's Retry puts back: whatever the standing refusal actually stopped. The QUEUE
    /// first — a refused flush is the one way a refusal comes to stand over an EMPTY field.
    mutating func retry(via deliver: ComposerSend) {
        guard queued.isEmpty else { return flush(via: deliver) }
        guard isSendable else { return }
        send(via: deliver)
    }

    /// Why `deliver` would not take these words, and `nil` when it did — the one place a thrown
    /// error becomes a sentence.
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
