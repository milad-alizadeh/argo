import Foundation

/// The questions half of the claim's gate: an `AskUserQuestion` blocked on the hook, and the answer
/// that goes back down the same socket.
///
/// Beside `PermissionChannel` rather than inside it, over one socket. The two are the same round
/// trip and the same claim, but they are answered by different ACTS — a Permission takes a word
/// from a vocabulary of two, and a question takes whatever somebody chose. Sharing the socket keeps
/// one
/// gate per claim; keeping the tables apart keeps the answer to one from ever reaching the other.
///
/// A question has no standing answer and no `allowAlways`: the same words asked twice are two
/// questions, and nothing here may answer the second on the strength of the first. So this gate is
/// its `PatienceTable` and nothing else — no policy above it, deliberately, where the two gates
/// beside it each have one.
@MainActor
final class AskGate {
    private struct Waiting: Patient {
        let ask: SessionAsk
        let reply: CompanionConnection.Reply
        let patiencePeer: Int?

        var patienceID: String {
            ask.id
        }
    }

    private let table: PatienceTable<SessionOwnership.ClaimID, Waiting>

    init(patience: PermissionPatience, ledger: ClaimLedger) {
        self.table = PatienceTable(patience: patience, prefix: "ask")
        table.changed = { claim, waiting in
            ledger.publish(asking: waiting.map(\.ask), for: claim)
        }
        // No expiry is published: a question nobody answered is nothing having happened, where a
        // refused Permission is a decision Argo made. The clock is a day, so it never decides — it
        // is there only so the hook is TOLD something rather than killed holding a question, which
        // the CLI reads as having no opinion and would run the picker into a PTY with no reader.
        table.expired = { _, gone in
            gone.reply(AskReply.expired)
        }
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
        table.raise(for: claim) { id in
            SessionAsk(line: line, id: id).map {
                Waiting(ask: $0, reply: reply, patiencePeer: peer)
            }
        } != nil
    }

    /// Answer the named waiting question. `false` when it is no longer waiting — an answer that
    /// raced the hook's own end, which the caller reports rather than swallows.
    func answer(
        _ answer: AskAnswer,
        answering askID: String,
        for claim: SessionOwnership.ClaimID,
    )
        -> Bool {
        table.answer(askID, for: claim) {
            $0.reply(AskReply.line(for: $0.ask, answering: answer))
        }
    }

    /// The PTY is gone, so nothing can be waiting on it. The questions go in silence, as the
    /// Permissions beside them do: nothing was refused, and nothing is left to read a refusal.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        table.withdraw(claim)
    }

    /// The hook went while Argo was still willing to wait, which means its turn was cancelled. The
    /// question goes without a word (#573).
    func peerClosed(_ claim: SessionOwnership.ClaimID, peer: Int) {
        table.peerGone(peer, for: claim)
    }
}
