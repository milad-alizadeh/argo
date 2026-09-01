import ArgoEngine

/// A subagent, as the rail names one. Everything here is read off the DELEGATING call — a
/// subagent's own turns run in a sidechain the parent does not attribute.
struct FeedAgent: Equatable, Sendable, Identifiable {
    /// Its place among the delegations — two subagents can be handed the same brief, so a list
    /// keyed by what they were asked would fuse them.
    let id: Int
    /// What it was handed, verbatim — the brief the delegating call named.
    let label: String
    /// Whether the delegation is still unresolved — see `FeedAgents.running(in:)`. Synchronously
    /// that is the gap between the call and its result; a backgrounded launch is answered at once
    /// and stays unresolved until its report lands as a second outcome (#908).
    let isRunning: Bool
    /// What it reported spending, where anything is reported at all. Synchronously `nil` means
    /// still working — the figure arrives with the result. A backgrounded agent never reports one:
    /// the launch receipt carries no `usage`, and the late report's spend is a shape Argo will not
    /// read (`TranscriptReader.swift`), so a finished async chip honestly has no spend to draw.
    let spend: Usage?
    /// The CLI's own id for this subagent, which is what its reading is keyed by — see
    /// `FeedAgentReader`. Synchronously it arrives with the result, so a running chip has nothing
    /// to key a reading by and is the UNSELECTABLE one; a backgrounded launch names `agentId` in
    /// the receipt, so a running async chip has its id from the start.
    var subagentID: String?
    /// How long it ran, as the host measured it. `nil` while a synchronous agent is still working —
    /// the total arrives with the result, as `spend` does — and `nil` for the whole life of a
    /// backgrounded one, which reports no total at either end.
    var durationMs: Int?
    /// When the work was handed over. What a running chip counts up from, since a total it does not
    /// have yet cannot be drawn.
    var startedAtMs: Int?
}
