import Foundation

/// Typing a Turn is not the same as the CLI hearing it (#682).
///
/// The Return that submits a Turn can be eaten by the file-mention popup an `@` token in the paste
/// opens. `ClaudeTurn` makes that unlikely by giving the Return its own read and its own pause, but
/// what closes that popup is a file search whose cost is the tree's — so a tree slow enough can
/// still swallow it, and the failure is silent by construction: the composer clears, and the agent
/// simply never answers.
///
/// So the Turn is watched rather than assumed, and what it is watched for is the COMPOSER letting
/// it go. A record cannot answer that on its own (#1266): a local command — `/clear` and the 56
/// others the #1234 survey found — is heard the instant it is typed and writes nothing at all, so
/// a watch reading the transcript alone sees a Session that took the Turn and one that dropped it
/// as the same silence, and calls both lost. The screen tells them apart, because the one thing
/// every Turn the CLI takes does is leave the composer.
///
/// The record still ends the watch, and ends it first: it is the CLI's own account of itself, the
/// one reading here that cannot be Argo agreeing with Argo. The screen is what answers where the
/// record has nothing to say.
///
/// Where NEITHER can answer — no screen wired, no composer drawn, a PTY nobody can paint — the
/// Turn is left standing and nothing is reported. That is the deliberate direction to be wrong in:
/// a Turn that was really eaten costs the reader a wait, while a Turn wrongly called lost puts the
/// words back under a notice saying they never ran, and the same words are sent twice.
///
/// The baseline it reads to do that is also what the roster needs to say a Turn is running (#1048),
/// so the submit is reported from here rather than counted again.
@MainActor
final class TurnDelivery {
    /// How long the CLI gets to answer before its silence counts.
    ///
    /// The issue's own repro sent its second Return after about 3 seconds and it submitted, so this
    /// is a wait that was known to be long enough before it was a constant. It is generous on
    /// purpose: every wait that ends early is a Return typed at a Session that was merely thinking.
    nonisolated static let patience = Duration.seconds(3)
    /// How many further Returns to type before the Turn is called lost. Two, because the first
    /// stands for the popup that was still open and the second for the machine that was busy —
    /// past that the silence is not about timing and another keystroke will not fix it.
    static let attempts = 2

    /// What a watch needs of the Hub, which travels together because it is one act read in four
    /// directions: what the Session itself says, that a Turn has just gone to it, how to type at
    /// it again, and where the answer goes.
    struct Watch {
        /// The two readings of the Session itself, grouped because the watch asks them as one
        /// question and answers `unheard` only when BOTH have nothing to report.
        let says: Says
        /// File the Turn just written to the PTY, against the Session it went to (#1048) — or
        /// `nil` to say the claim is OVER, which is what bounds it (#1409).
        ///
        /// Both directions through one answer, exactly as `ClaimLedger.setLostTurn` takes its own
        /// `nil`: the claim opens when Argo types and closes when this watch is done with it, and
        /// a second answer beside this one would be a second place the two could disagree.
        let submitted: (SessionTurnSubmission?, String) -> Void
        /// Type one more Return at that Session, and `false` where no PTY answers any more.
        let retype: (String) -> Bool
        /// File a Turn the CLI never heard, by the Session it was meant for.
        let lost: (String, String) -> Void

        /// What the Session has to say about a Turn: the record it wrote, and the screen it
        /// painted.
        struct Says {
            /// What the Session has written, as a count that only grows. `events.count` off the
            /// roster: the transcript is the CLI's own account of itself, and it is the one thing
            /// here that cannot be Argo agreeing with Argo.
            let records: (String) -> Int
            /// What the Session's own screen says about the Turn just typed at it (#1266) — read
            /// through the channel, because only a surface Argo owns a PTY for has a screen.
            let echo: (String, String) -> TurnEcho
        }
    }

    /// The answers this watch was built with. Readable rather than `private` so a suite can
    /// assert what the Hub WIRED — the count that follows the re-key is the whole of #1176, and a
    /// test of the resolution alone would not notice this closure being pointed back at the row.
    let watch: Watch
    /// Held rather than read off `Self.patience`, so a test can watch a Turn without waiting the
    /// nine seconds a real one is given.
    private let patience: Duration
    private var watching: [String: Task<Void, Never>] = [:]

    init(_ watch: Watch, patience: Duration = TurnDelivery.patience) {
        self.watch = watch
        self.patience = patience
    }

    /// Watch the Turn just typed at that Session, replacing whatever was being watched there: one
    /// Session has one composer, so a second Turn means the first is no longer the one in flight.
    func typed(_ text: String, to sessionID: String) {
        watching[sessionID]?.cancel()
        // Read HERE and not inside the watch: the Turn has just been written, and anything the
        // CLI writes from now on is an answer to it. A baseline taken when the watch first runs
        // would already include the record that proves it arrived, and read it as silence.
        let before = watch.says.records(sessionID)
        // The same reading, filed: a Turn Argo wrote is DIRECT news that one opened, and it is
        // this count that later says whether the record has answered it (#1048).
        watch.submitted(
            SessionTurnSubmission(text: text, recordsWhenSubmitted: before), sessionID,
        )
        watching[sessionID] = Task { [weak self] in
            await self?.watchForAnswer(to: text, at: sessionID, since: before)
        }
    }

    /// Stop watching, without filing anything — the Session is gone, and a Turn nobody can retype
    /// is not news the composer can act on.
    func forget(_ sessionID: String) {
        watching.removeValue(forKey: sessionID)?.cancel()
    }

    /// Whether a Turn is still being watched at that Session. What a suite asserts a `forget` by:
    /// the alternative is waiting out every attempt to watch nothing happen, and a wall-clock guess
    /// is how a test goes green on the race it meant to run.
    func isWatching(_ sessionID: String) -> Bool {
        watching[sessionID] != nil
    }

    func forgetAll() {
        for watch in watching.values {
            watch.cancel()
        }
        watching = [:]
    }

    private func watchForAnswer(to text: String, at id: String, since before: Int) async {
        for _ in 0 ..< Self.attempts {
            switch await answer(to: text, at: id, since: before) {
            case .cancelled: return
            case .answered: return over(id)
            case let .said(echo):
                // No PTY left to type at, so waiting again would only delay the same answer.
                guard watch.retype(id) else { return finish(text, to: id, saying: echo) }
            }
        }
        switch await answer(to: text, at: id, since: before) {
        case .cancelled: return
        case .answered: over(id)
        case let .said(echo): finish(text, to: id, saying: echo)
        }
    }

    /// Argo's own claim that a Turn is in flight, ENDED — the bound on it, and the whole of #1409's
    /// first symptom.
    ///
    /// `SessionTurnSubmission` ends on the record growing and on nothing else, so a Turn the CLI
    /// took and wrote no record for — a local `/command` writes none at all, which is #1266's own
    /// finding — left the Session reading `running` at DIRECT for the rest of the window: no
    /// hand-off, a plinth standing over a Plan that read `6/6 done`, and a Stop that could not
    /// reach the claim because an `ESC` at a prompt the CLI is already back at writes no record
    /// either.
    ///
    /// This watch is the bound, because this watch is the whole life of the claim: it was set up to
    /// see the answer, and once it is done looking, "no record has answered it YET" has no `yet`
    /// left in it. What the Session is doing from here is the RECORD's to say — which is
    /// `isAwaitingRecord`'s own rule, read at the one moment it could not reach.
    ///
    /// Not called on a cancelled watch, and that is the sharp edge: `typed` cancels the watch it is
    /// replacing, and a cancelled watch filing `nil` afterwards would end the claim the Turn that
    /// replaced it had just filed.
    private func over(_ sessionID: String) {
        watching.removeValue(forKey: sessionID)
        watch.submitted(nil, sessionID)
    }

    /// Why one wait ended, in the three directions the watch has to tell apart (#1409).
    ///
    /// Told apart because the two quiet endings are NOT the same news: a Turn the CLI took ends
    /// Argo's own claim (`over(_:)`), and a watch somebody replaced must leave the claim its
    /// replacement just filed exactly where it is.
    private enum Waited {
        /// The Session said something about the Turn, and the watch has more to do.
        case said(TurnEcho)
        /// The CLI has the Turn: the record moved, or the composer let it go.
        case answered
        /// A fresh Turn replaced this watch, or the Session is being torn down.
        case cancelled
    }

    /// One wait, and what the Session then says about the Turn.
    ///
    /// `unreadable` comes back as something SAID rather than as an ending, because a Return typed
    /// at a composer that took the last one does nothing — so a screen Argo cannot read keeps the
    /// #682 recovery it always had, and only loses the right to call the Turn lost at the end of
    /// it.
    private func answer(to text: String, at id: String, since before: Int) async -> Waited {
        try? await Task.sleep(for: patience)
        guard !Task.isCancelled else { return .cancelled }
        // The record first: it is the CLI's own account of itself, and it settles a Turn the agent
        // has already begun answering whatever its screen is doing.
        guard watch.says.records(id) == before else { return .answered }
        switch watch.says.echo(text, id) {
        case .heard: return .answered
        case .unheard: return .said(.unheard)
        case .unreadable: return .said(.unreadable)
        }
    }

    /// Stop watching — and report the Turn ONLY where the composer was seen still holding it. A
    /// Turn Argo could not read the composer for is left standing and nothing is said (#1266).
    private func finish(_ text: String, to sessionID: String, saying echo: TurnEcho) {
        switch echo {
        // The Turn is reported lost, which ENDS the claim in the same write
        // (`ClaimLedger.setLostTurn`) — so this path does its own ending and takes no second one.
        case .unheard:
            watching.removeValue(forKey: sessionID)
            watch.lost(text, sessionID)
        // Nothing is SAID about a Turn Argo could not read the composer for, and the claim still
        // ends: saying nothing is #1266's rule about the WORDS, and it was never a licence to go
        // on claiming a Turn is running over a screen nobody could read (#1409).
        case .heard, .unreadable:
            over(sessionID)
        }
    }
}
