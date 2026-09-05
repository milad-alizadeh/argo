/// What a BACKGROUNDED delegation is holding open in a record (`CONTEXT.md` L3 · Subagent).
///
/// A backgrounded delegation is answered twice: a launch receipt at once, which resolves nothing,
/// and a report later that ends the call (#908). Between the two the record carries an open call
/// and no boundary after it, so the Turn reads open and the Session reads `running` — for as long
/// as the report takes, and for ever where it is lost (#1267).
///
/// **The receipt is what makes this readable at all, and it is why nothing here needs a clock.**
/// `DelegationCeiling` is a stated figure about how long a report can still be IN FLIGHT, and it
/// answers a different question — whether the child is still working. This one asks whether the
/// PARENT is, and the record already says so: a receipt is the host telling Argo it handed the work
/// off and came back. A CLI that has come back is a CLI at its prompt, whether its child reports in
/// a minute or never.
///
/// One-directional, on `DelegationCeiling`'s own terms: it only ever takes a "the parent is busy"
/// claim away, and only on the evidence of a receipt the record actually carries. A delegation with
/// no receipt is a SYNCHRONOUS one — the parent is genuinely blocked on it — and is not here.
public struct DelegationHold: Equatable, Sendable {
    /// The backgrounded delegations still open, by call id, in the order the work was handed over.
    /// Empty for a record holding none, which is nearly every record.
    public let backgrounded: [String]

    /// Whether those delegations are the WHOLE of what the record leaves unanswered.
    ///
    /// The half that makes the reading safe. A record can carry a backgrounded delegation and a
    /// `Bash` the agent is still inside; there the parent is busy with the Bash, and the receipt
    /// beside it says nothing about that. So the claim is made only where every open call is one of
    /// these — the parent handed everything off and has nothing else in hand.
    public let isAlone: Bool

    /// The ones the reader has ENDED from the rail (#1267), by call id — Argo's own gesture, and
    /// DIRECT. Carried inside the reading rather than beside it so no surface has to join the two:
    /// what a chip draws, what the status word says and what the composer does are one answer.
    public let ended: Set<String>

    /// Whether the Turn's openness rests on these delegations alone.
    ///
    /// `false` for a record with none: absence of a backgrounded delegation is not a claim that the
    /// parent is free, and reading it as one would call every mid-Turn Session idle.
    public var holdsTurn: Bool {
        isAlone && !backgrounded.isEmpty
    }

    /// Whether the reader has ended every delegation the Turn is held open by (#1267) — the
    /// question `HubSession.statusReading` reads `idle` off.
    ///
    /// ALL of them and not any: a Session with two children out, one ended and one still going, is
    /// still holding one delegation the reader has not spoken about.
    public var isEnded: Bool {
        holdsTurn && backgrounded.allSatisfy(ended.contains)
    }

    /// Whether ONE delegation is among them — what the rail's chip draws its ending from, and the
    /// same fact read per child rather than over the whole fan-out.
    ///
    /// `false` for a chip with no call id, which is not a claim about it: a delegation the record
    /// never named cannot have been the one the reader ended.
    public func isEnded(_ callID: String?) -> Bool {
        guard let callID else { return false }
        return ended.contains(callID)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085), and the
    /// cockpit's fixtures state a hold rather than assembling a stream to read one off.
    public init(backgrounded: [String], isAlone: Bool, ended: Set<String> = []) {
        self.backgrounded = backgrounded
        self.isAlone = isAlone
        self.ended = ended
    }

    /// A record holding nothing — what a stream with no delegation in it reads, and what a surface
    /// with no stream to read takes.
    public static let none = DelegationHold(backgrounded: [], isAlone: false)

    /// What one stream leaves open, in a single forward pass.
    ///
    /// The LAST outcome under an id decides it, exactly as `FeedAgents` reads them: a backgrounded
    /// call is answered twice, and the receipt is only the first of the two.
    ///
    /// A Turn boundary clears the slate. A call left unanswered by a Turn that has since ended is
    /// not holding anything open — it is a call the CLI abandoned — and counting one would refuse
    /// the reading for every Session that has ever been interrupted mid-tool.
    public static func read(
        _ events: [TranscriptEvent],
        ended: Set<String> = [],
    )
        -> DelegationHold {
        var open: [String: ToolCall] = [:]
        var order: [String] = []
        var outcomes: [String: ToolCallStatus] = [:]
        for event in events {
            switch event {
            case let .toolCall(call):
                open[call.id] = call
                order.append(call.id)
                outcomes[call.id] = nil
            case let .toolCallOutcome(outcome):
                outcomes[outcome.id] = outcome.status
            case .turnEnded, .interrupted:
                open = [:]
                order = []
                outcomes = [:]
            default:
                break
            }
        }
        let unanswered = order.filter { id in
            switch outcomes[id] {
            case .none, .pending, .inProgress: true
            case .completed, .failed: false
            }
        }
        let backgrounded = unanswered.filter {
            open[$0]?.kind == .delegate && outcomes[$0] == .inProgress
        }
        return DelegationHold(
            backgrounded: backgrounded,
            isAlone: backgrounded.count == unanswered.count,
            ended: ended,
        )
    }
}
