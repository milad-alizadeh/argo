import ArgoEngine

/// A subagent, as the rail names one. Everything here is read off the DELEGATING call — a
/// subagent's own turns run in a sidechain the parent does not attribute.
package struct FeedAgent: Equatable, Sendable, Identifiable {
    /// Its place among the delegations — two subagents can be handed the same brief, so a list
    /// keyed by what they were asked would fuse them.
    package let id: Int
    /// What it was handed, verbatim — the brief the delegating call named.
    let label: String
    /// Working, landed, or a state Argo cannot establish — see `FeedAgents.activity(_:of:at:)` for
    /// the facts behind each, and `AgentActivity` for why there are three.
    ///
    /// Synchronously, `pending` is the gap between the call and its result; a backgrounded launch
    /// is answered at once and stays unresolved until its report lands as a second outcome (#908),
    /// which is why the Session's own status and `DelegationCeiling` are read beside it: a report
    /// that never lands leaves a pending call nothing will ever close, in a dead Session (#1076)
    /// and in a live one alike (#1090). And where those cannot decide, the child's OWN file can —
    /// `SubagentWriting`, applied by `FeedAgents.told(_:by:at:)` (#1269).
    package var activity: AgentActivity
    /// What it REPORTED spending, where anything is reported at all. Synchronously `nil` means
    /// still working — the figure arrives with the result. A backgrounded agent never reports one:
    /// the launch receipt carries no `usage`, and the late report's spend is a shape Argo will not
    /// read (`TranscriptReader.swift`) — so for those `spend` falls back to the child's own record
    /// below, and this stays the answer to "what did the DELEGATION state".
    let reportedSpend: Usage?
    /// What the delegating call handed over — see `FeedCall.Handover`, whose whole value this is.
    /// One value rather than four slots, for the reason it is one there (#755).
    package var handover: FeedCall.Handover
    /// What the child's OWN record measures, where Argo has read it (`SubagentMeasure`, #1279) —
    /// the span and the spend a backgrounded delegation never states. `unmeasured` by default,
    /// which is degrade-down: a chip nobody has read measures nothing, and a zero would claim the
    /// work was instant and free.
    ///
    /// Set after the init rather than through it, and for `delegationHold`'s reason: that list is
    /// at the count it is grandfathered at (`swift-boundaries` edge 6), and one more parameter
    /// would authorise the next one.
    var measure = SubagentMeasure.unmeasured

    /// The CLI's own id for this subagent, which is what its reading is keyed by — see
    /// `FeedAgentReader`. Forwarded off `handover` so the surfaces that read it are about the fact
    /// rather than about where it is stored.
    ///
    /// Synchronously it arrives with the result, so a running chip has nothing to key a reading by
    /// and is the UNSELECTABLE one; a backgrounded launch names `agentId` in the receipt, so a
    /// running async chip has its id from the start.
    package var subagentID: String? {
        handover.subagentID
    }

    /// REPORTED WINS, in all three below: the delegation's own figure stands wherever there is
    /// one, and the child's record answers only where it stated none (#1279).
    var spend: Usage? {
        reportedSpend ?? measure.usage
    }

    /// How long it ran, as the host measured it. The measured span is WITHHELD from a running
    /// chip: `AgentMeter` draws a stated total in preference to counting up, so a span measured
    /// off what has been read SO FAR would replace a live clock with a frozen one — the untruth
    /// #1076 and #1090 removed, arrived at from the other side. The spend is not withheld, because
    /// tokens read so far are tokens spent so far and that figure only grows.
    var durationMs: Int? {
        if let reported = handover.durationMs {
            return reported
        }
        return activity.isRunning ? nil : measure.durationMs
    }

    /// When the work was handed over, and what a running chip counts up from. Where the delegating
    /// call was never dated, the earliest moment in the child's own record stands in for it.
    var startedAtMs: Int? {
        handover.startedAtMs ?? measure.firstAtMs
    }

    /// The BACKGROUNDED delegation's own call id, where this chip is one the record has not closed
    /// (#1267) — what the reader's End gesture names, and `nil` for every chip there is nothing to
    /// end. See `FeedCall.Handover.openDelegationID`, which is where both halves of that are read.
    package var openDelegationID: String? {
        handover.openDelegationID
    }

    /// Whether the delegation left any figure for the child's own record to fill (#1279).
    ///
    /// Read in TWO places — `FeedAgentReader`, which decides whose file to look up, and
    /// `FeedAgents.measured`, which applies the answer — so the rule is spelled here rather than in
    /// either of them. A chip whose record stated all three asks the reading nothing at all.
    var wantsMeasuring: Bool {
        spend == nil || durationMs == nil || startedAtMs == nil
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        id: Int,
        label: String,
        activity: AgentActivity,
        spend: Usage?,
        handover: FeedCall.Handover = FeedCall.Handover(),
    ) {
        self.id = id
        self.label = label
        self.activity = activity
        self.reportedSpend = spend
        self.handover = handover
    }
}
