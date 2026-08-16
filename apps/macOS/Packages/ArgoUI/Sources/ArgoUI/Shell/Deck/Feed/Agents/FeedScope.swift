/// Whose work the deck's one feed is reading.
///
/// The feed is RE-SCOPED, never duplicated. A second feed beside the first would ask the reader to
/// hold two places in two records at once, and it would make the rail a reading surface when the
/// rail is navigation — the feed stays the primary surface (D33).
enum FeedScope: Hashable, Sendable {
    /// The root Agent: the Session's own reading, which is where the deck opens and what Escape
    /// comes back to.
    case session
    /// One Subagent, addressed by the delegation that started it rather than by the CLI's id for
    /// it — two Agents handed the same brief keep two chips, so the delegation is what tells them
    /// apart (`FeedAgent.id`).
    case subagent(FeedAgent.ID)
}

extension FeedScope {
    /// Which chip is lit, or `nil` while the Session's own reading is up.
    var agent: FeedAgent.ID? {
        switch self {
        case .session: nil
        case let .subagent(agent): agent
        }
    }
}
