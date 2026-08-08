/// What the world OUTSIDE the transcript says about the CLI behind a Session.
///
/// Two signals, neither of them a key. A `claude` matched on a working directory could be a second
/// agent in the same repo, and a transcript's last write goes stale while an agent thinks — which
/// is why every status read through this one is DERIVED, and why the two have to agree before
/// anything is called live.
public enum SessionLiveness: Sendable, Equatable {
    /// A process matched, and the record corroborates it with a recent write.
    case live
    /// Nothing corroborates this Session running. Also the honest default for a liveness that was
    /// never read at all: ambiguity resolves toward the quieter state.
    case quiet
}

public extension SessionLiveness {
    /// A live process sits quiet mid-tool, so a match alone says little. Only a record touched
    /// within this window corroborates one actively running.
    static let recentActivityWindowMs = 10 * 60 * 1000

    /// Both signals, or quiet. A match with no recent write is the long-think case read down; a
    /// recent write with no process is a Session whose CLI has since gone.
    static func read(processMatch: Bool, lastActivityAtMs: Int?, nowMs: Int) -> SessionLiveness {
        guard processMatch, let lastActivityAtMs else { return .quiet }
        return nowMs - lastActivityAtMs <= recentActivityWindowMs ? .live : .quiet
    }
}
