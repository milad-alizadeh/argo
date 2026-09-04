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
    /// NOTHING here is measured against a clock, which is what lets this be memoised under
    /// `SessionsRoomReadingCache`'s stamp: that stamp carries no clock, so anything read off one
    /// would freeze at the moment the parent last wrote. The two facts that need one — the report
    /// ceiling and the child's own growth — are both taken in `told(_:writing:at:)`, on the list
    /// this returns. A clock in the stamp would instead expire every memo in the room on a timer,
    /// which is the cost #858 and #875 exist to have removed.
    package static func all(
        in rows: [FeedRow],
        of session: DelegatingSession,
    )
        -> [FeedAgent] {
        rows.compactMap(delegation(in:)).enumerated().map { position, call in
            FeedAgent(
                id: position,
                // The disambiguated address: a row here stands alone in a column of its own, with
                // no line beside it to tell two same-named subjects apart.
                label: call.subject.captioned,
                activity: activity(call, of: session),
                spend: call.spend,
                subagentID: call.subagentID,
                durationMs: call.durationMs,
                startedAtMs: call.startedAtMs,
            )
        }
    }

    /// The same list, dated: what the Subagents' OWN files say, and how long the silent ones have
    /// been silent (#1269).
    ///
    /// Everything with a clock in it lives HERE and not in `all(in:of:)`, because that walk is
    /// memoised under the room's stamp and the room's stamp does not move for a child's bytes —
    /// that is the whole of #858. A timed reading folded into the memo would freeze at whatever was
    /// true when the parent last wrote, which is the failure this ticket is about, one level down.
    /// This is a cheap pass over a list the memo already holds, so it is taken every time.
    ///
    /// The ORDER is the ruling: growth is asked first, so an observation outranks a stated ceiling.
    /// `DelegationCeiling` says how long a report can still be in flight and names itself a stated
    /// figure rather than an observation — and Argo watching the child write is an observation, so
    /// a Subagent still going at five hours keeps its dot rather than being quieted for being slow.
    /// The ceiling then reaches what is left: silence, past the age at which silence means the
    /// report was lost (#1090).
    ///
    /// A `.finished` chip is never reopened. That is the record having ANSWERED the delegation, and
    /// a trailing byte in the child's file does not un-answer it.
    ///
    /// `writing` is asked by Subagent ID, so an Agent the record never named has no file to watch
    /// and is never asked about — both halves of "which chips the evidence can reach" spelled here,
    /// rather than one of them living in whichever closure was passed in.
    static func told(
        _ agents: [FeedAgent],
        writing: (String) -> SubagentWriting,
        at nowMs: Int = Date().epochMs,
    )
        -> [FeedAgent] {
        agents.map { agent in
            guard agent.activity != .finished else { return agent }
            var told = agent
            if agent.subagentID.map({ writing($0) }) == .writing {
                told.activity = .running
            } else if DelegationCeiling.passed(sinceMs: agent.startedAtMs, nowMs: nowMs) {
                told.activity = .finished
            }
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
        agents.filter(\.activity.isRunning).count
    }

    /// One chip's own share of that claim, spelled here so the list above reads as one line per
    /// fact the rail draws — and the TIMELESS half of it, which is what `told(_:writing:at:)` is
    /// handed to date.
    ///
    /// The ending first, because it is the one thing Argo simply KNOWS: a delegation the record
    /// resolved is over. What is left is an open delegation, and the delegating Session decides it
    /// — down to `unknown` where that Session is one whose silence says nothing about it
    /// (`DelegatingSession`).
    private static func activity(
        _ call: FeedCall,
        of session: DelegatingSession,
    )
        -> AgentActivity {
        guard call.ending == .pending else { return .finished }
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
