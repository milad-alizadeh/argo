import ArgoEngine
import Foundation

/// How a Turn leaves the composer: the words, and whatever was on the tray with them.
///
/// One closure and not two, because they are one act — the paths are named INSIDE the Turn the
/// words are in (`SessionTurn.text(_:attaching:)`), so an attach that went and a send that did not
/// would leave files written for a message nobody sent.
package typealias ComposerSend = (String, [SessionAttachment]) throws -> Void

/// What the field holds, what is waiting behind it, and why the last attempt to send did not go.
/// Also what the per-Session store (`ComposerDrafts`) keeps.
package struct ComposerDraft: Equatable {
    package var text: String
    /// What is on the tray above the field, in the order it was given (#540). The order is the
    /// contract: it is the order the Turn names the paths in.
    ///
    /// Not `private(set)` like its neighbours: the rules that mutate it live in
    /// `ComposerDraft+Attachments.swift`, and Swift's `private` is file-scoped.
    var attachments: [SessionAttachment]
    /// What Argo did to this draft that the reader did not do — a drop the adapter would not take
    /// (#540), or the follow-ups an interrupt dropped (#541). Quieter than `refusal` and outranked
    /// by it.
    ///
    /// Mutated through `say(_:)`, so it and the output behind it move together.
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
    ///
    /// Not `private(set)` like its neighbours, for the reason `attachments` is not: the rules that
    /// mutate it live in `ComposerDraft+Mode.swift`, and Swift's `private` is file-scoped.
    var heldMode: SessionMode?
    /// Whether the walk for `heldMode` has begun, so no second boundary can start another (#653).
    /// Not `private(set)`, on the same rule as `heldMode` above.
    var isWalkingMode = false
    /// How many Stops this composer has landed that no boundary has answered yet (#1189, #1234).
    /// Not part of `isEmpty`: it is a claim about an act in flight, never something a reader typed.
    ///
    /// A COUNT and not a flag, though only `> 0` is ever asked of it here: it is what the vessel
    /// keys its wait on (`SessionComposer.watchStop(patience:)`), and two Stops with no boundary
    /// between them are two acts. A flag already true the second time would not move, so the second
    /// click would be watched by nobody.
    private(set) var unansweredStops = 0

    package init(
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

    /// Whether this draft holds anything at all — nothing typed, nothing waiting, nothing said,
    /// and no rung held for the Turn. What the store keys eviction on: a draft evicted while it
    /// holds a rung is one whose rung is never walked.
    var isEmpty: Bool {
        text.isEmpty && queued.isEmpty && attachments.isEmpty && refusal == nil && notice == nil
            && heldMode == nil
    }

    /// Put the draft to the Session through `deliver`. A refusal keeps every character where it
    /// was typed and every chip where it was dropped — a failed send must never clear the field.
    package mutating func send(via deliver: ComposerSend) {
        refused(by: Self.refusal(putting: text, attaching: attachments, via: deliver))
        guard refusal == nil else { return }
        text = ""
        attachments = []
        say(nil)
    }

    /// Stand under a refusal, or take the standing one away. Every mutation of the pair goes
    /// through here, so the seam's gesture cannot open one refusal's output under another's line.
    /// The memberwise init is the one other writer, and it takes a bare sentence: a fixture has no
    /// port to have printed anything.
    private mutating func refused(by line: ComposerSeamLine?) {
        refusal = line?.detail
        refusalOutput = line?.output
    }

    /// Say something about this draft that the reader did not do, or take back what was said. Pairs
    /// the notice with its output on the same rule `refused(by:)` states.
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

    /// What an interrupt takes from the composer: the QUEUE, and nothing else (#541).
    ///
    /// A follow-up typed while the Turn ran is released the moment that Turn ends — and an
    /// interrupt IS it ending, so without this the very next thing the Session received would be
    /// instructions written for the run somebody had just killed. Words still in the field were
    /// never handed over, so nothing releases them and there is nothing to take back.
    ///
    /// It says what it took rather than taking it quietly, and only when it took something: an
    /// interrupt with no follow-ups behind it leaves the seam alone.
    ///
    /// A refusal takes NOTHING, which is decision 8's rule read at this act: nothing was stopped,
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
        // A standing refusal goes, whatever it stood over. Its RETRY is the reason and not
        // housekeeping: after this act the queue is empty, so `retry(via:)` falls through to the
        // FIELD — and a reader pressing a button that means "try that again" would send the words
        // they are still typing as a fresh Turn. That includes the refusal a first, refused Stop
        // put up, which a landing second Stop has just answered. Left standing it also OUTRANKS
        // the line below, so the drop the reader needs told about is never drawn.
        refused(by: nil)
        // Argo's own Stop drops the queue HERE, at the click, ahead of the record: waiting for the
        // status to turn would be waiting for the exact moment the follow-ups are released. The
        // claim is spent by the boundary that follows — see `mustDropQueue(afterInterrupt:)`.
        unansweredStops += 1
        dropQueue()
    }

    /// The wait after a Stop went by and no boundary came with it (#1234).
    ///
    /// Given the OUTCOME rather than the act, for the reason `turnLost(_:whileRunning:)` is: the
    /// waiting happens seconds after the click returned, and a `mutating` method cannot hold a
    /// draft open across it. The vessel does the waiting; this decides what to say about it.
    ///
    /// It says nothing where a boundary has already answered — the wait is keyed to a value that
    /// moves, but the vessel and the record race and the record is allowed to win.
    ///
    /// A NOTICE and not a refusal: nothing was sent and no unsent words are at risk, which is the
    /// rule `dropQueue` states. And it does not stand over a refusal, which is the louder and more
    /// exact answer to the same click — `ComposerSeamNote` already ranks the two, so a refused Stop
    /// keeps the port's own reason rather than having it replaced by this vaguer one.
    mutating func stopDidNotTake() {
        guard unansweredStops > 0 else { return }
        say(ComposerSeamLine(Self.stopDidNotTake))
    }

    /// What the seam says about it. Two claims, and neither is one Argo cannot stand behind: the
    /// keystroke went and the Session has not come off `running`. Never that the agent is still
    /// working, which is a DERIVED reading Argo does not own, and never that the Stop failed, which
    /// nothing here can see.
    package static let stopDidNotTake = "Stop did not take. The Session is still running."

    /// Drop what was waiting on the Turn, and say so where anything was.
    ///
    /// Its own method because Argo's Stop button is not the only way a Turn gets stopped: an `ESC`
    /// typed at the dock terminal ends it just as truly, and the follow-ups waiting on it were
    /// written for the run that was killed either way (#1189). That path reaches this through
    /// `SessionComposer.turnEnded()`, off the record rather than off a click.
    mutating func dropQueue() {
        guard !queued.isEmpty else { return }
        queued = []
        say(ComposerSeamLine(Self.droppedQueue))
    }

    /// Whether the queue behind a Turn the RECORD says was stopped still has to be dropped here.
    ///
    /// `false` where this composer's own Stop already did it at the click, and that is the one
    /// case the record cannot settle: a follow-up typed AFTER the Stop, while the status still
    /// read `running` because the record had not caught up, is the reader's intent for what comes
    /// next rather than instructions for the run they killed — so it is released, not dropped.
    ///
    /// The claim is spent by any boundary, not only by the one it was made for: a Stop whose
    /// interrupt the record somehow never reports must not go on swallowing the next one's drop.
    mutating func mustDropQueue(afterInterrupt wasInterrupted: Bool) -> Bool {
        defer { unansweredStops = 0 }
        return wasInterrupted && unansweredStops == 0
    }

    /// The seam's sentence for it. Named rather than written at the call site, so the test that
    /// asserts the reader was told and the vessel that tells them cannot come to disagree.
    ///
    /// It names the follow-ups and not "the composer", because the words in the field are still
    /// there: a line saying more went than went would send the reader looking for what they can
    /// already see.
    package static let droppedQueue = "Turn stopped — the queued follow-ups were dropped"

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
    /// A Turn the feed is drawing RUNNING is not a Turn the CLI never heard, so the news is spent
    /// without a word and without the words (#1176). The vessel's own invariant and not the fix:
    /// what MADE the watch report a landed Turn lost is fixed in the engine, at `recordCount`.
    /// This says the weaker thing the composer can answer for by itself — that a sentence never
    /// goes back into the field directly below the sentence answering it, which is a state the
    /// reader can act on twice — and it holds however the watch comes to be wrong next.
    ///
    /// It answers nothing, and a standing notice is not a guard (#1183): spending the news is the
    /// caller's act (`SessionComposer.lostTurnArrived(_:)`), and `isSendable` already refuses a
    /// field in use — which covers a reader mid-sentence AND the field these words just went into.
    mutating func turnLost(_ text: String, whileRunning isRunning: Bool) {
        guard !isRunning else { return }
        say(ComposerSeamLine(Self.lost))
        guard !isSendable else { return }
        self.text = text
    }

    /// Whether the lost-Turn line standing here is one the reader already met, rather than this
    /// visit's (#1183). The line outlives the deck the way the words do — the draft store is per
    /// Session, not per visit — so without taking it down on arrival the notice greets them again
    /// however faithfully the news itself was spent.
    ///
    /// News STILL standing on the Hub is this visit's to say. That is what makes the two arrival
    /// passes order-independent: neither answer depends on whether the other has run.
    ///
    /// An ANSWER and not the act, so the arrival can write through its `@Binding` only when there
    /// is something to write: a binding's setter runs whether or not the value moved, and the
    /// selection pass is counted to the read (ADR-0028 Rule 3, `PerfBudgets.selectionPassReads`).
    func isLostTurnStale(newsStanding: Bool) -> Bool {
        notice == Self.lost && !newsStanding
    }

    /// What the seam says about a Turn the CLI never heard. It does not offer a Retry: the words
    /// are back in the field where Send is, and a second button for the same act would be a second
    /// answer to "how do I send this".
    package static let lost = "The agent never received that message — your words are back below"

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
