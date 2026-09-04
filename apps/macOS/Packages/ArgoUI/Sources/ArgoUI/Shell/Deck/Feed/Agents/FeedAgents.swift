import ArgoEngine
import Foundation

/// Who else is working, read off the feed the reader is already looking at.
///
/// ONE reading, not two: the rail's visibility and the chips in it are the same claim about the
/// same rows, so a count cannot disagree with the list it counts.
package enum FeedAgents {
    /// Every subagent the reading knows about, in the order the work was handed over.
    ///
    /// One row is one child, and that holds because a delegation is never collapsed into another
    /// (`FeedCall.stands(for:)`): two agents handed the same brief keep two rows, two endings and
    /// two spends.
    ///
    /// `nowMs` is the clock the ceiling below is measured against, and it is defaulted rather than
    /// threaded: every shipping caller wants the real one, and a suite that passed it would be the
    /// only place a fixed moment is worth having.
    ///
    /// Read WHEN THE LIST IS DERIVED, which on the shipping path is under
    /// `SessionsRoomReadingCache`'s stamp — and that stamp carries no clock, so a chip cannot cross
    /// the ceiling while nothing else about the reading moves. Nothing is owed for that, because
    /// what the ceiling would take away is a claim this no longer makes on its own: a running
    /// Session that writes nothing is read `idle` inside `SessionLiveness.recentActivityWindowMs`,
    /// and an idle Session's open delegation is `unknown` rather than running (#1269). A chip left
    /// past the ceiling by a stalled stamp is drawn as a state Argo cannot place, which is what it
    /// is. A clock in the stamp would instead expire every memo in the room on a timer, which is
    /// the cost #858 and #875 exist to have removed.
    package static func all(
        in rows: [FeedRow],
        of session: DelegatingSession,
        at nowMs: Int = Date().epochMs,
    )
        -> [FeedAgent] {
        rows.compactMap(delegation(in:)).enumerated().map { position, call in
            FeedAgent(
                id: position,
                // The disambiguated address: a row here stands alone in a column of its own, with
                // no line beside it to tell two same-named subjects apart.
                label: call.subject.captioned,
                activity: activity(call, of: session, at: nowMs),
                spend: call.spend,
                subagentID: call.subagentID,
                durationMs: call.durationMs,
                startedAtMs: call.startedAtMs,
            )
        }
    }

    /// The same list, told what the Subagents' OWN files say (#1269).
    ///
    /// Applied HERE and not inside `all(in:of:at:)` on purpose: that walk is memoised under the
    /// room's stamp, and the room's stamp does not move for a child's bytes — that is the whole of
    /// #858. A growth reading folded into the memo would freeze at whatever the child was doing
    /// when the parent last wrote, which is the exact failure this ticket is about, one level down.
    /// This is a cheap pass over a list the memo already holds, so it is taken every time.
    ///
    /// It only ever settles `unknown`, per `SubagentWriting`: a delegation the record closed stays
    /// closed, and one past the ceiling stays lost.
    static func told(
        _ agents: [FeedAgent],
        writing: (FeedAgent) -> SubagentWriting,
    )
        -> [FeedAgent] {
        agents.map { agent in
            guard agent.activity == .unknown, writing(agent) == .writing else { return agent }
            var told = agent
            told.activity = .running
            return told
        }
    }

    /// How many of them are running right now — the count line's figure and the list under it,
    /// from one reading (`AgentsRail`).
    ///
    /// THREE facts behind each one, never one: a delegation the transcript has not resolved, in a
    /// Session that is itself running (`DelegatingSession`), handed over recently enough that its
    /// report could still be coming (`DelegationCeiling`). A backgrounded launch is answered at
    /// once by a receipt that resolves nothing (#908), so where its report never lands the call
    /// stays pending for the life of the record (#1076) — and the Session's own status closes only
    /// the half of that gap where the Session has gone. The ceiling closes the other half, which is
    /// the running Session still holding yesterday's delegations (#1090).
    ///
    /// A FOURTH fact reaches the ones those three leave undecided, and it is not in the record at
    /// all: the Subagent's own file, growing (`told(_:writing:)`, #1269).
    static func running(of agents: [FeedAgent]) -> Int {
        agents.filter(\.isRunning).count
    }

    /// One chip's own share of that claim, spelled here so the list above reads as one line per
    /// fact the rail draws.
    ///
    /// The two endings first, because both are things Argo KNOWS: a delegation the record resolved
    /// is over, and one whose report is past `DelegationCeiling` was lost rather than is late
    /// (#1090). What is left is an open delegation, and the delegating Session decides it — down to
    /// `unknown` where that Session is one whose silence says nothing (`DelegatingSession`).
    ///
    /// Nothing here reads the child's own file: this walk is memoised under a stamp a child's bytes
    /// do not move, so that reading belongs in `told(_:writing:)` above.
    private static func activity(
        _ call: FeedCall,
        of session: DelegatingSession,
        at nowMs: Int,
    )
        -> AgentActivity {
        guard call.ending == .pending,
              !DelegationCeiling.passed(sinceMs: call.startedAtMs, nowMs: nowMs)
        else { return .finished }
        switch session {
        case .running: return .running
        case .notRunning: return .finished
        case .undecided: return .unknown
        }
    }

    /// The delegation a row is, or `nil` — which is also what says the rail has nothing to show
    /// for it.
    private static func delegation(in row: FeedRow) -> FeedCall? {
        guard case let .call(call) = row.content, call.kind == .delegate else { return nil }
        return call
    }
}
