import Foundation

/// Typing a Turn is not the same as the CLI hearing it (#682).
///
/// The Return that submits a Turn can be eaten by the file-mention popup an `@` token in the paste
/// opens. `ClaudeTurn` makes that unlikely by giving the Return its own read and its own pause, but
/// what closes that popup is a file search whose cost is the tree's — so a tree slow enough can
/// still swallow it, and the failure is silent by construction: the composer clears, and the agent
/// simply never answers.
///
/// So the Turn is watched rather than assumed. The CLI writing ANYTHING is the evidence it heard
/// one, because a Turn that lands opens a record and a Turn that was eaten leaves the transcript
/// exactly as it was. Silence is answered with another Return, which is safe for the reason the
/// issue's own repro is: a Return at a composer holding nothing does nothing.
///
/// The baseline it reads to do that is also what the roster needs to say a Turn is running (#1048),
/// so the submit is reported from here rather than counted again.
///
/// Reading growth as arrival is the deliberate direction to be wrong in. Retyping a Return nobody
/// asked for could submit half a sentence in an attached pane, while reading it the other way costs
/// one wait — so anything at all in the record ends the watch.
@MainActor
final class TurnDelivery {
    /// How long the CLI gets to write something before its silence counts.
    ///
    /// The issue's own repro sent its second Return after about 3 seconds and it submitted, so this
    /// is a wait that was known to be long enough before it was a constant. It is generous on
    /// purpose: every wait that ends early is a Return typed at a Session that was merely thinking.
    nonisolated static let patience = Duration.seconds(3)
    /// How many further Returns to type before the Turn is called lost. Two, because the first
    /// stands for the popup that was still open and the second for the machine that was busy —
    /// past that the silence is not about timing and another keystroke will not fix it.
    static let attempts = 2

    /// The four things a watch needs of the Hub, which travel together because they are one act
    /// read in four directions: what the Session has written, that a Turn has just gone to it, how
    /// to type at it again, and where the answer goes.
    struct Watch {
        /// What the Session has written, as a count that only grows. `events.count` off the
        /// roster: the transcript is the CLI's own account of itself, and it is the one thing here
        /// that cannot be Argo agreeing with Argo.
        let records: (String) -> Int
        /// File the Turn just written to the PTY, against the Session it went to (#1048).
        let submitted: (SessionTurnSubmission, String) -> Void
        /// Type one more Return at that Session, and `false` where no PTY answers any more.
        let retype: (String) -> Bool
        /// File a Turn the CLI never heard, by the Session it was meant for.
        let lost: (String, String) -> Void
    }

    private let watch: Watch
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
        let before = watch.records(sessionID)
        // The same reading, filed: a Turn Argo wrote is DIRECT news that one opened, and it is
        // this count that later says whether the record has answered it (#1048).
        watch.submitted(SessionTurnSubmission(recordsWhenSubmitted: before), sessionID)
        watching[sessionID] = Task { [weak self] in
            await self?.watchForRecord(of: text, to: sessionID, since: before)
        }
    }

    /// Stop watching, without filing anything — the Session is gone, and a Turn nobody can retype
    /// is not news the composer can act on.
    func forget(_ sessionID: String) {
        watching.removeValue(forKey: sessionID)?.cancel()
    }

    func forgetAll() {
        for watch in watching.values {
            watch.cancel()
        }
        watching = [:]
    }

    private func watchForRecord(of text: String, to sessionID: String, since before: Int) async {
        for _ in 0 ..< Self.attempts {
            guard await heardNothing(from: sessionID, since: before) else { return }
            // No PTY left to type at, so waiting again would only delay the same answer.
            guard watch.retype(sessionID) else { return finish(text, to: sessionID) }
        }
        guard await heardNothing(from: sessionID, since: before) else { return }
        finish(text, to: sessionID)
    }

    /// One wait, and whether the Session is still exactly as silent as it was. `false` the moment
    /// the watch is cancelled, so a Session being torn down files nothing.
    private func heardNothing(from sessionID: String, since before: Int) async -> Bool {
        try? await Task.sleep(for: patience)
        guard !Task.isCancelled else { return false }
        return watch.records(sessionID) == before
    }

    private func finish(_ text: String, to sessionID: String) {
        watching.removeValue(forKey: sessionID)
        watch.lost(text, sessionID)
    }
}
