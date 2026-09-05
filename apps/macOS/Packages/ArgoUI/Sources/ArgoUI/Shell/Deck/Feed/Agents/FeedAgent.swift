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
    /// `SubagentWriting`, applied by `FeedAgents.told(_:writing:)` (#1269).
    package var activity: AgentActivity
    /// What it reported spending, where anything is reported at all. Synchronously `nil` means
    /// still working — the figure arrives with the result. A backgrounded agent never reports one:
    /// the launch receipt carries no `usage`, and the late report's spend is a shape Argo will not
    /// read (`TranscriptReader.swift`), so a finished async chip honestly has no spend to draw.
    let spend: Usage?
    /// What the delegating call handed over — see `FeedCall.Handover`, whose whole value this is.
    /// One value rather than four slots, for the reason it is one there (#755).
    package var handover: FeedCall.Handover

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

    /// How long it ran, as the host measured it, and when the work was handed over. `FeedCall
    /// .Handover`'s own two, forwarded for the reason above.
    var durationMs: Int? {
        handover.durationMs
    }

    var startedAtMs: Int? {
        handover.startedAtMs
    }

    /// The BACKGROUNDED delegation's own call id, where this chip is one the record has not closed
    /// (#1267) — what the reader's End gesture names, and `nil` for every chip there is nothing to
    /// end. See `FeedCall.Handover.openDelegationID`, which is where both halves of that are read.
    package var openDelegationID: String? {
        handover.openDelegationID
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
        self.spend = spend
        self.handover = handover
    }
}
