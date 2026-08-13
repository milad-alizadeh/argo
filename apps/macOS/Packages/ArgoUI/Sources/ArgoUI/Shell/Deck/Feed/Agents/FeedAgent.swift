import ArgoEngine

/// A subagent, as the rail names one. Everything here is read off the DELEGATING call — a
/// subagent's own turns run in a sidechain the parent does not attribute.
struct FeedAgent: Equatable, Sendable, Identifiable {
    /// Its place among the delegations — two subagents can be handed the same brief, so a list
    /// keyed by what they were asked would fuse them.
    let id: Int
    /// What it was handed, verbatim — the brief the delegating call named.
    let label: String
    /// Whether the record has answered its delegation yet: the gap between the call and its result
    /// IS the child's whole life — see `FeedAgents.running(in:)`.
    let isRunning: Bool
    /// What it reported spending. `nil` is the ordinary case for a subagent still working: nothing
    /// is reported until the delegating call comes back.
    let spend: Usage?
    /// The CLI's own id for this subagent, which is what its reading is keyed by — see
    /// `FeedAgentScope`. `nil` while it is still working: the name arrives with the result, so a
    /// running chip is selectable and has nothing to show yet.
    var subagentID: String?
    /// How long it ran, as the host measured it. `nil` while it is still working — nothing reports
    /// a total until the delegating call comes back, which is when `spend` arrives too.
    var durationMs: Int?
    /// When the work was handed over. What a running chip counts up from, since a total it does not
    /// have yet cannot be drawn.
    var startedAtMs: Int?
}
