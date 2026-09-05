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
        agents(handedOver: handovers(in: rows), of: session)
    }

    /// The same list off the Session's own STREAM, for a surface with no feed rows to read that
    /// cannot afford to build them: the roster draws this once per row on every pass, and
    /// `FeedProjection.rows` is a dozen folds over the whole record — about thirty times the work
    /// of this walk at either transcript size (#1394).
    ///
    /// Honest to walk separately because no fold can reach a delegation: one is never collapsed
    /// into another (`FeedCall.stands(for:)`), so the delegate calls in a reading are the delegate
    /// calls in the stream. Both entry points then hand the same calls to `agents(handedOver:of:)`
    /// below, which is what keeps the roster's count and the rail's one answer rather than two —
    /// the disagreement #1269 was written for.
    package static func all(
        in events: [TranscriptEvent],
        of session: DelegatingSession,
        within path: FeedPath,
    )
        -> [FeedAgent] {
        agents(handedOver: handovers(in: events, within: path), of: session)
    }

    /// One delegation as the rail reads it: the call, and the delegation's OWN half of every
    /// running claim made about it.
    private struct Handover {
        let call: FeedCall
        /// A Turn ended, or somebody stopped one, AFTER the work was handed over
        /// (`FeedMark.endsTurn`). A synchronous delegation blocks the Turn that made it, so its own
        /// Turn cannot have ended while it runs; a backgrounded one outlives its Turn by design and
        /// is reached instead by the child's own file (`told(_:writing:at:)`, #1269).
        let turnEnded: Bool
    }

    /// One `FeedAgent` per delegation, in the order the work was handed over. The single place a
    /// `FeedAgent` is built, so neither entry point can grow a reading of its own.
    private static func agents(handedOver handovers: [Handover], of session: DelegatingSession)
        -> [FeedAgent] {
        handovers.enumerated().map { position, handover in
            let call = handover.call
            return FeedAgent(
                id: position,
                // The disambiguated address: a row here stands alone in a column of its own, with
                // no line beside it to tell two same-named subjects apart.
                label: call.subject.captioned,
                activity: activity(handover, of: session),
                spend: call.spend,
                handover: call.handover,
            )
        }
    }

    /// The delegate rows, each told whether a Turn closed below it. One `lastIndex` rather than a
    /// search per delegation: boundaries only ever move forwards, so a call sits in a closed Turn
    /// exactly when it is above the LAST of them.
    private static func handovers(in rows: [FeedRow]) -> [Handover] {
        let closed = rows.lastIndex { $0.kind.endsTurn }
        return rows.enumerated().compactMap { position, row in
            delegation(in: row).map {
                Handover(call: $0, turnEnded: closed.map { position < $0 } ?? false)
            }
        }
    }

    /// The delegate calls in the stream, each paired with the outcome that answered it and told the
    /// same fact about its Turn.
    ///
    /// Forwards, gathering the outcomes in the same pass: a call and its result sit arbitrarily far
    /// apart, and a backgrounded delegation is answered twice — a receipt at once and a report
    /// later (#908) — so the LAST outcome under an id is the one that decides it.
    private static func handovers(in events: [TranscriptEvent], within path: FeedPath)
        -> [Handover] {
        var outcomes: [String: ToolCallOutcome] = [:]
        var handedOver: [(call: ToolCall, at: Int)] = []
        var closed: Int?
        for (position, event) in events.enumerated() {
            // ASKED, never restated: the boundary rule the rows read off their marks
            // (`TranscriptEvent.endsTurn`), so the roster and the rail cannot part company on it.
            if event.endsTurn {
                closed = position
            }
            switch event {
            case let .toolCallOutcome(outcome): outcomes[outcome.id] = outcome
            case let .toolCall(call) where call.kind == .delegate:
                handedOver.append((call, position))
            default: break
            }
        }
        return handedOver.compactMap { handed in
            FeedCallReading.call(handed.call, outcome: outcomes[handed.call.id], within: path)
                .map { Handover(call: $0, turnEnded: closed.map { handed.at < $0 } ?? false) }
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
    /// The ORDER is the ruling, and the READER is at the head of it (#1267): a delegation somebody
    /// ended is over, whatever the child's file is still doing — the gesture is DIRECT and the two
    /// readings under it are not. Then growth, so an observation outranks a stated ceiling.
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
        ended: DelegationHold = .none,
        at nowMs: Int = Date().epochMs,
    )
        -> [FeedAgent] {
        agents.map { agent in
            guard agent.activity != .finished else { return agent }
            var told = agent
            if ended.isEnded(agent.openDelegationID) {
                told.activity = .finished
            } else if agent.subagentID.map({ writing($0) }) == .writing {
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
    /// THREE facts behind each one, never one: a delegation the transcript has not resolved, by a
    /// Turn a Session that is itself running has not yet closed (`DelegatingSession`, `Handover`),
    /// handed over recently enough that its report could still be coming (`DelegationCeiling`). The
    /// Turn is what keeps the first two from being a fact about the PARENT alone, which is the rail
    /// opening on a status change (#1277). A backgrounded launch is answered at
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
    ///
    /// A running Session only decides the ones handed over by the Turn it is STILL IN: its status
    /// is a fact about the PARENT, and read off that alone every pending call the record never
    /// closed counted again the moment somebody sent an unrelated Turn (#1277). Past that boundary
    /// Argo cannot say from the record — `unknown` and not `finished`, because a backgrounded
    /// Subagent genuinely outlives the Turn that launched it.
    private static func activity(
        _ handover: Handover,
        of session: DelegatingSession,
    )
        -> AgentActivity {
        guard handover.call.ending == .pending else { return .finished }
        switch session {
        case .running: return handover.turnEnded ? .unknown : .running
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
