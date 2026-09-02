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
    /// the ceiling while nothing else about the reading moves. The gap closes itself rather than
    /// needing a clock in the key: the ceiling only ever fires for a Session `DelegatingSession`
    /// calls running, and a running Session that writes nothing is read `idle` inside
    /// `SessionLiveness.recentActivityWindowMs` — which moves the stamp AND quiets the chip by the
    /// second fact. A clock in the stamp would instead expire every memo in the room on a timer,
    /// which is the cost #858 and #875 exist to have removed.
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
                isRunning: running(call, of: session, at: nowMs),
                spend: call.spend,
                subagentID: call.subagentID,
                durationMs: call.durationMs,
                startedAtMs: call.startedAtMs,
            )
        }
    }

    /// How many of them are running right now, as far as the record can say — the count line's
    /// figure and the list under it, from one reading (`AgentsRail`).
    ///
    /// THREE facts behind each one, never one: a delegation the transcript has not resolved, in a
    /// Session that is itself running (`DelegatingSession`), handed over recently enough that its
    /// report could still be coming (`DelegationCeiling`). A backgrounded launch is answered at
    /// once by a receipt that resolves nothing (#908), so where its report never lands the call
    /// stays pending for the life of the record (#1076) — and the Session's own status closes only
    /// the half of that gap where the Session has gone. The ceiling closes the other half, which is
    /// the running Session still holding yesterday's delegations (#1090).
    static func running(of agents: [FeedAgent]) -> Int {
        agents.filter(\.isRunning).count
    }

    /// One chip's own share of that claim, spelled here so the list above reads as one line per
    /// fact the rail draws.
    private static func running(
        _ call: FeedCall,
        of session: DelegatingSession,
        at nowMs: Int,
    )
        -> Bool {
        session.isRunning && call.ending == .pending
            && !DelegationCeiling.passed(handedOverAtMs: call.startedAtMs, nowMs: nowMs)
    }

    /// The delegation a row is, or `nil` — which is also what says the rail has nothing to show
    /// for it.
    private static func delegation(in row: FeedRow) -> FeedCall? {
        guard case let .call(call) = row.content, call.kind == .delegate else { return nil }
        return call
    }
}
