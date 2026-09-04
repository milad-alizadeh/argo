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
    /// The CLI's own id for this subagent, which is what its reading is keyed by — see
    /// `FeedAgentReader`. Synchronously it arrives with the result, so a running chip has nothing
    /// to key a reading by and is the UNSELECTABLE one; a backgrounded launch names `agentId` in
    /// the receipt, so a running async chip has its id from the start.
    package var subagentID: String?
    /// How long it ran, as the host measured it. `nil` while a synchronous agent is still working —
    /// the total arrives with the result, as `spend` does — and `nil` for the whole life of a
    /// backgrounded one, which reports no total at either end.
    var durationMs: Int?
    /// When the work was handed over. What a running chip counts up from, since a total it does not
    /// have yet cannot be drawn.
    var startedAtMs: Int?

    /// Whether the rail counts this one. The count line says `running`, so only `.running` is.
    var isRunning: Bool {
        activity.isRunning
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        id: Int,
        label: String,
        activity: AgentActivity,
        spend: Usage?,
        subagentID: String? = nil,
        durationMs: Int? = nil,
        startedAtMs: Int? = nil,
    ) {
        self.id = id
        self.label = label
        self.activity = activity
        self.spend = spend
        self.subagentID = subagentID
        self.durationMs = durationMs
        self.startedAtMs = startedAtMs
    }
}
