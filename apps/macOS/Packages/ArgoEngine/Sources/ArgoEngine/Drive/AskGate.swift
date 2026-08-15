import Foundation

/// The questions half of the claim's gate: an `AskUserQuestion` blocked on the hook, and the answer
/// that goes back down the same socket.
///
/// Beside `PermissionChannel` rather than inside it, over one socket. The two are the same round
/// trip and the same claim, but they are answered by different ACTS — a Permission takes a word
/// from
/// a vocabulary of two, and a question takes whatever somebody chose. Sharing the socket keeps one
/// gate per claim; keeping the tables apart keeps the answer to one from ever reaching the other.
///
/// A question has no standing answer and no `allowAlways`: the same words asked twice are two
/// questions, and nothing here may answer the second on the strength of the first.
@MainActor
final class AskGate {
    private struct Waiting {
        let ask: SessionAsk
        let peer: Int
        let reply: CompanionConnection.Reply
        /// The gate's own clock, cancelled by every other way this can end. Argo's runs out before
        /// the hook's for the reason a Permission's does: a hook killed holding a question is one
        /// the CLI reads as having no opinion, and it would then run the picker into a PTY with no
        /// reader.
        let clock: Task<Void, Never>
    }

    private let patience: PermissionPatience
    private let ledger: ClaimLedger
    private var waiting: [SessionOwnership.ClaimID: [Waiting]] = [:]
    private var issued = 0

    init(patience: PermissionPatience, ledger: ClaimLedger) {
        self.patience = patience
        self.ledger = ledger
    }

    /// Take one hook payload as a question, and answer whether it WAS one. `false` leaves the line
    /// to the gate's ordinary reading — a call named for the tool whose input carried no readable
    /// question is not one anybody can answer.
    ///
    /// The rung is not consulted. A boundary the agent asks to cross is a Permission, and `Auto`
    /// waves those through; a question is the agent wanting to know something, which no rung
    /// answers on the user's behalf.
    func raise(
        _ line: String,
        for claim: SessionOwnership.ClaimID,
        peer: Int,
        reply: @escaping CompanionConnection.Reply,
    )
        -> Bool {
        issued += 1
        guard let ask = SessionAsk(line: line, id: "ask-\(issued)") else { return false }
        waiting[claim, default: []].append(Waiting(
            ask: ask,
            peer: peer,
            reply: reply,
            clock: arm(ask.id, for: claim),
        ))
        publish(claim)
        return true
    }

    /// Answer the named waiting question. `false` when it is no longer waiting — an answer that
    /// raced the hook's own end, which the caller reports rather than swallows.
    ///
    /// By id and never by position, for the reason `decide` is: a Session can have more than one
    /// question up, and a row replaced between the reading and the click would send the answer to
    /// the question underneath.
    func answer(
        _ answer: AskAnswer,
        answering askID: String,
        for claim: SessionOwnership.ClaimID,
    )
        -> Bool {
        guard let answered = take(askID, for: claim) else { return false }
        answered.reply(AskReply.line(for: answered.ask, answering: answer))
        publish(claim)
        return true
    }

    /// The PTY is gone, so nothing can be waiting on it. The questions go in silence, as the
    /// Permissions beside them do: nothing was refused, and nothing is left to read a refusal.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        for one in waiting.removeValue(forKey: claim) ?? [] {
            one.clock.cancel()
        }
        publish(claim)
    }

    /// The hook went while Argo was still willing to wait, which means its turn was cancelled. The
    /// question goes without a word (#573).
    func peerClosed(_ claim: SessionOwnership.ClaimID, peer: Int) {
        guard let standing = waiting[claim], standing.contains(where: { $0.peer == peer })
        else { return }
        for one in standing where one.peer == peer {
            one.clock.cancel()
        }
        waiting[claim] = standing.filter { $0.peer != peer }
        publish(claim)
    }

    /// Argo's clock for one question. It is a day, so it is never the thing that decides — it is
    /// there only so the hook is always TOLD something rather than killed holding a question.
    ///
    /// No expiry is published. A refused Permission is a decision Argo made about a call somebody
    /// wanted; a question nobody answered is nothing having happened, and a reading of it would be
    /// a fact about the user rather than about the Session.
    private func arm(_ askID: String, for claim: SessionOwnership.ClaimID) -> Task<Void, Never> {
        Task { [weak self, patience] in
            try? await Task.sleep(for: .seconds(patience.seconds))
            guard !Task.isCancelled else { return }
            self?.expire(askID, for: claim)
        }
    }

    private func expire(_ askID: String, for claim: SessionOwnership.ClaimID) {
        guard let gone = take(askID, for: claim) else { return }
        gone.reply(PermissionReply.expired)
        publish(claim)
    }

    /// Lift one question out of the table, stopping its clock: every way a question ends that is
    /// not the clock firing must stop it, or an answered one would report an expiry over it.
    private func take(_ askID: String, for claim: SessionOwnership.ClaimID) -> Waiting? {
        guard var standing = waiting[claim],
              let index = standing.firstIndex(where: { $0.ask.id == askID })
        else { return nil }
        let taken = standing.remove(at: index)
        waiting[claim] = standing
        taken.clock.cancel()
        return taken
    }

    private func publish(_ claim: SessionOwnership.ClaimID) {
        ledger.publish(asking: waiting[claim]?.map(\.ask) ?? [], for: claim)
    }
}
