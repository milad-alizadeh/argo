import ArgoEngine

/// A subagent, as the rail names one: what it was handed, whether it is still on it, and what it
/// reported spending.
///
/// Everything here is read off the DELEGATING call, because that is the only place the parent's
/// record says anything about a child at all — its own turns run in a sidechain the parent does not
/// attribute. A rail that claimed more would be claiming it from nowhere.
struct FeedAgent: Equatable, Sendable, Identifiable {
    /// Its place among the delegations, which is the only stable handle a rail has: two subagents
    /// can be handed the same brief, and a list keyed by what they were asked would fuse them.
    let id: Int
    /// What it was handed, verbatim — the brief the delegating call named.
    let label: String
    /// Whether the record has answered its delegation yet. The gap between the call and its result
    /// IS the child's whole life, which is the same reading the rail's own visibility is decided
    /// by — see `FeedAgents.running(in:)`.
    let isRunning: Bool
    /// What it reported spending, where it reported anything. `nil` is the ordinary case for a
    /// subagent still working: nothing is reported until the delegating call comes back.
    let spend: Usage?
}
