import ArgoEngine

/// A delegation, over — the moment the record answered it, as its own row in the reading (#1281).
///
/// A second row and never an edit to the `Delegated` one above it: the handover and the ending are
/// two moments, and folding them into one line would take away the stretch between them, which is
/// the part the reader was waiting on.
///
/// Built from the delegating call the record ANSWERED, so a delegation nothing ever closes writes
/// nothing here — Argo does not invent an ending it cannot see (#1076, #1090) — and neither does
/// the launch receipt a backgrounded handover is answered with at once (#908), which resolves the
/// call no more than the ceiling does.
package struct FeedDelegationEnd: Equatable, Sendable {
    /// What the delegation was handed, exactly as the row that handed it over named it — so two
    /// Subagents with different briefs are told apart by the same words in both places.
    let subject: FeedCall.Subject
    /// How it went. Never `pending`: an ending that has not happened has no row.
    let ending: FeedCall.Ending
    /// How long it ran, as the host measured it. `nil` where the record reported none — a
    /// backgrounded Agent reports no total at either end (#908), and the row still lands.
    let durationMs: Int?
    /// What the whole Subagent cost, where the result priced it. `nil` reads as unpriced and never
    /// as free, which is why nothing is drawn in its place.
    let spend: Usage?

    /// `nil` for every call that is not a delegation the record has answered — the one gate on
    /// whether this row exists, said once. Every ending the feed draws comes through here, so
    /// nothing downstream re-asks whether a row should have existed.
    init?(_ call: FeedCall) {
        guard call.kind == .delegate, call.ending != .pending else { return nil }
        self.init(
            subject: call.subject,
            ending: call.ending,
            durationMs: call.durationMs,
            spend: call.spend,
        )
    }

    /// The facts alone, for a fixture or a preview standing an ending up with no call behind it.
    /// Spelled out because the gate above takes the memberwise initialiser Swift would synthesise.
    init(subject: FeedCall.Subject, ending: FeedCall.Ending, durationMs: Int?, spend: Usage?) {
        self.subject = subject
        self.ending = ending
        self.durationMs = durationMs
        self.spend = spend
    }

    /// The shortest thing that names which delegation this was, with no row beside it to borrow
    /// from.
    var label: String {
        subject.captioned
    }

    /// The ink the whole line takes, which the lane beside it reads too. A failure is the only
    /// ending with a colour, exactly as it is on a call's own row.
    var ink: FeedInk {
        ending.ink
    }

    /// The whole row as one sentence, for a reader who cannot see it. The ending comes back in
    /// words here, because it is drawn as a colour and a colour says nothing in the ear.
    var spoken: String {
        [
            FeedDelegationEndCopy.verb,
            label,
            durationMs.map { TurnClockPhrase.spoken(seconds: $0 / 1000) },
            spend.map(FeedSpend.agentWords),
            ending.spoken,
        ]
        .compactMap(\.self)
        .joined(separator: ", ")
    }
}

/// What the end row says, as a value rather than a literal inside a `body` — a string in a `View`
/// is a string no suite can reach.
enum FeedDelegationEndCopy {
    /// One word, in the past, as every verb in the feed is. It stays the same where the delegation
    /// failed: the Subagent DID come back, with a failure in its hands, and how it went is said in
    /// the ink of the line — the grammar `FeedCallLine` already holds every other call to.
    static let verb = "Returned"
}
