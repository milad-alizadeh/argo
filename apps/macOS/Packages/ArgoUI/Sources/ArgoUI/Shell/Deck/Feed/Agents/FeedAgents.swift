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
    /// ceiling and the child's own growth — are both taken in `told(_:by:at:)`, on the list this
    /// returns. A clock in the stamp would instead expire every memo in the room on a timer,
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
        /// is reached instead by the child's own file (`told(_:by:at:)`, #1269).
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
    /// The ORDER is the ruling, and it runs from the strongest evidence to the weakest.
    ///
    /// The ENDED GESTURE first (#1267): a delegation somebody ended is over, whatever the child's
    /// file is still doing. The gesture is DIRECT and every reading under it is not.
    ///
    /// GROWTH next, so an observation outranks everything stated: Argo watching the child write is
    /// evidence somebody is working, and a Subagent still going at five hours keeps its dot rather
    /// than being quieted for being slow. It is also what keeps the reading below honest — the CLI
    /// splits one assistant message across a record per content block, so a live child's file
    /// passes through "ends in prose" on its way to the tool call in the same message, and only the
    /// bytes still arriving tell that moment from an ending (`SubagentEnding`).
    ///
    /// The child's own ENDING next, on what is left: a file that has gone quiet, whose last words
    /// were the report the Subagent stopped to file (#1392). That is the child's record answering
    /// about itself, so it outranks a figure Argo states about reports in general — and it reaches
    /// in minutes the fan-out whose closing `task-notification` never landed, which the ceiling
    /// below took four hours to reach.
    ///
    /// The ceiling LAST, on what none of those settled: silence from a child Argo has no reading
    /// of, past the age at which silence means the report was lost (#1090).
    ///
    /// A `.finished` chip is never reopened. That is the record having ANSWERED the delegation, and
    /// a trailing byte in the child's file does not un-answer it.
    ///
    /// The evidence is asked by Subagent ID, so an Agent the record never named has no file to read
    /// and is never asked about — both halves of "which chips the evidence can reach" spelled here,
    /// rather than one of them living in whichever closure was passed in.
    ///
    /// The activity is settled BEFORE the figures are, and that order is load-bearing: a derived
    /// duration is withheld from a running chip, so measuring first would hand a frozen total to a
    /// chip the growth reading was about to set running (#1279).
    static func told(
        _ agents: [FeedAgent],
        by evidence: SubagentEvidence,
        ended: DelegationHold = .none,
        at nowMs: Int = Date().epochMs,
    )
        -> [FeedAgent] {
        agents.map { measured(dated($0, by: evidence, ended: ended, at: nowMs), by: evidence) }
    }

    /// One chip's activity, told by the clocked facts — the ruling the doc comment above states,
    /// and the whole of what `told` did before the figures joined it.
    private static func dated(
        _ agent: FeedAgent,
        by evidence: SubagentEvidence,
        ended: DelegationHold,
        at nowMs: Int,
    )
        -> FeedAgent {
        guard agent.activity != .finished else { return agent }
        var told = agent
        if ended.isEnded(agent.openDelegationID) {
            told.activity = .finished
        } else if agent.subagentID.map({ evidence.writing($0) }) == .writing {
            told.activity = .running
        } else if agent.subagentID.map({ evidence.ending($0) }) == .stopped {
            told.activity = .finished
        } else if DelegationCeiling.passed(sinceMs: agent.startedAtMs, nowMs: nowMs) {
            told.activity = .finished
        }
        return told
    }

    /// The two figures the delegation itself never stated, off the child's own record (#1279).
    ///
    /// REPORTED WINS. Each is filled only where the record stated none, so a synchronous agent's
    /// host-measured pair still stands — and a chip whose record stated all three asks the reading
    /// nothing at all.
    ///
    /// The DURATION is withheld from a running chip. `AgentMeter` draws a stated total in
    /// preference to counting up, so a span measured off what has been read SO FAR would replace a
    /// live clock with a frozen one — the untruth #1076 and #1090 removed, arrived at from the
    /// other side. The spend is not withheld: tokens read so far are tokens spent so far, and that
    /// figure only grows.
    private static func measured(_ agent: FeedAgent, by evidence: SubagentEvidence) -> FeedAgent {
        guard let id = agent.subagentID, agent.wantsMeasuring else { return agent }
        var told = agent
        told.measure = evidence.measure(id)
        return told
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
    /// all: the Subagent's own file, growing (`told(_:by:at:)`, #1269).
    static func running(of agents: [FeedAgent]) -> Int {
        agents.filter(\.activity.isRunning).count
    }

    /// One chip's own share of that claim, spelled here so the list above reads as one line per
    /// fact the rail draws — and the TIMELESS half of it, which is what `told(_:by:at:)` is
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
