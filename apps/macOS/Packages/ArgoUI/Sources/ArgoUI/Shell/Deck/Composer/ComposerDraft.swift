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
    ///
    /// Set through `say(_:)` rather than written to, so it and the output behind it move together.
    private(set) var notice: String?
    /// Why the last send was refused, and `nil` the moment one goes through.
    private(set) var refusal: String?
    /// What the port printed behind `refusal`, and `nil` where Argo worded that line itself (§5).
    private(set) var refusalOutput: RawOutput?
    /// What the port printed behind `notice`, on the same rule.
    private(set) var noticeOutput: RawOutput?
    /// The follow-ups typed while a Turn was running, oldest first — they are sent in the order
    /// they were typed.
    private(set) var queued: [QueuedTurn]
    /// When the field was last typed in, as the roster spells a time; `nil` for a draft nobody has
    /// touched.
    var editedAtMs: Int?
    /// A rung picked while a Turn was running, waiting on the boundary to be walked (#940). It
    /// sits here beside the queued follow-ups because it is the same kind of thing: an intent the
    /// running Turn has to end before Argo can carry it out — and it lives exactly as long, which
    /// is to say across a switch and not across a restart.
    private(set) var heldMode: SessionMode?
    /// Whether the walk for `heldMode` has begun, so no second boundary can start another (#653).
    private(set) var isWalkingMode = false

    init(
        text: String = "",
        refusal: String? = nil,
        queued: [QueuedTurn] = [],
        editedAtMs: Int? = nil,
        attachments: [SessionAttachment] = [],
        notice: String? = nil,
        heldMode: SessionMode? = nil,
    ) {
        self.text = text
        self.refusal = refusal
        self.queued = queued
        self.editedAtMs = editedAtMs
        self.attachments = attachments
        self.notice = notice
        self.heldMode = heldMode
    }

    /// Whether there is anything to send, by the port's own rule. A tray with something on it IS a
    /// Turn, with no words at all.
    var isSendable: Bool {
        SessionTurn.isSendable(text) || !attachments.isEmpty
    }

    /// Whether this draft holds anything at all — anything Stop would clear, or a rung waiting on
    /// the Turn. What the store keys eviction on: a draft evicted while it holds a rung is one
    /// whose rung is never walked.
    var isEmpty: Bool {
        isClear && heldMode == nil
    }

    /// Whether Stop has anything to take away. The held rung is NOT among it: a rung is about how
    /// the Session works next rather than about the Turn that was killed, and it survives the
    /// interrupt to be walked at the boundary the interrupt itself creates.
    private var isClear: Bool {
        text.isEmpty && queued.isEmpty && attachments.isEmpty && refusal == nil && notice == nil
    }

    /// Put the draft to the Session through `deliver`. A refusal keeps every character where it
    /// was typed and every chip where it was dropped — a failed send must never clear the field.
    mutating func send(via deliver: ComposerSend) {
        refused(by: Self.refusal(putting: text, attaching: attachments, via: deliver))
        guard refusal == nil else { return }
        text = ""
        attachments = []
        say(nil)
    }

    /// Stand under a refusal, or take the standing one away. The line and the output behind it are
    /// written together here and nowhere else, so the seam's gesture cannot open one refusal's
    /// output under another's line.
    private mutating func refused(by line: ComposerSeamLine?) {
        refusal = line?.detail
        refusalOutput = line?.output
    }

    /// Say something about this draft that the reader did not do, or take back what was said. Pairs
    /// the notice with its output the way `refused(by:)` pairs a refusal with its own.
    mutating func say(_ line: ComposerSeamLine?) {
        notice = line?.detail
        noticeOutput = line?.output
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
        refused(by: nil)
        say(nil)
    }

    /// Deliver what was waiting, oldest first, when the Turn it was waiting on ends. A refusal
    /// stops the run where it happened — the turns it never reached stay queued.
    mutating func flush(via deliver: ComposerSend) {
        guard !queued.isEmpty else { return }
        while let next = queued.first {
            if let line = Self.refusal(
                putting: next.text,
                attaching: next.attachments,
                via: deliver,
            ) {
                return refused(by: line)
            }
            queued.removeFirst()
            refused(by: nil)
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
        } catch {
            return refused(by: ComposerSeamLine(error))
        }
        guard !isClear else { return }
        text = ""
        attachments = []
        queued = []
        refused(by: nil)
        say(ComposerSeamLine(Self.cleared))
    }

    /// The seam's sentence for it. Named rather than written at the call site, so the test that
    /// asserts the reader was told and the vessel that tells them cannot come to disagree.
    static let cleared = "Turn stopped — the composer was cleared"

    /// The port's reason a rung did not land (#545), on the seam as a notice rather than a
    /// refusal: no words are at risk, so there is nothing for the seam's Retry to put back.
    ///
    /// Given the outcome rather than the act, because the walk is `async` (#653) and a `mutating`
    /// method cannot hold a draft open across the wait.
    mutating func modeRefused(_ error: any Error) {
        heldMode = nil
        isWalkingMode = false
        say(ComposerSeamLine(error))
    }

    /// The rung landed. It takes back only the sentence IT put up — a notice about something else,
    /// the Turn the reader stopped or the one the CLI never heard, is not this act's to erase.
    mutating func modeLanded(_ mode: SessionMode) {
        heldMode = nil
        isWalkingMode = false
        guard notice == Self.held(mode) else { return }
        say(nil)
    }

    /// A rung the port refused because a Turn is running (#653, #940): kept for the boundary
    /// rather than dropped, and said on the seam.
    mutating func modeHeld(_ mode: SessionMode) {
        heldMode = mode
        isWalkingMode = false
        say(ComposerSeamLine(Self.held(mode)))
    }

    /// The rung to walk now the Turn has ended, and `nil` where there is none or a walk is already
    /// under way. MARKED rather than taken: the picker draws the held rung until the walk lands,
    /// and a rung taken twice would be walked twice from a stance the first walk had left (#653).
    mutating func beginModeWalk() -> SessionMode? {
        guard let heldMode, !isWalkingMode else { return nil }
        isWalkingMode = true
        return heldMode
    }

    /// What the seam says about a rung Argo is holding: the port's own refusal first, verbatim,
    /// then what Argo did with the intent. Both halves, because a reader who picked a rung needs
    /// to know it was refused AND that it was not dropped.
    static func held(_ mode: SessionMode) -> String {
        "\(SessionDriveError.modeBusy.detail) — \(mode.label) is held until this Turn ends"
    }

    /// A Turn the CLI never heard, come back to the field it was typed in (#682).
    ///
    /// Given the outcome rather than the act, for the reason `modeRefused(_:)` is: the news
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
        say(ComposerSeamLine(Self.lost))
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
    /// error becomes a sentence, and what the port printed behind it.
    private static func refusal(
        putting text: String,
        attaching attachments: [SessionAttachment],
        via deliver: ComposerSend,
    )
        -> ComposerSeamLine? {
        do {
            try deliver(text, attachments)
            return nil
        } catch {
            return ComposerSeamLine(error)
        }
    }
}
