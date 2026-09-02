/// Whether one Session's companion channel is up (#493). DIRECT: Argo owns the socket, so it
/// accepted the dial and the kernel tells it about the hang-up.
///
/// Two constraints on the next edit here. It is never read off `managed`-ness — a `codex` claim
/// takes no companion plugin at all, and an orphaned Session that read `live` off its posture would
/// be a false DIRECT. And it is never read off SILENCE: the plugin's MCP server holds one
/// long-lived client, so a thinking agent's channel is still up, and neither end sends a heartbeat
/// for a threshold to measure.
public enum CompanionLiveness: Equatable, Sendable, CaseIterable {
    /// A client holds the channel open — the route is there. Whether the agent has anything to say
    /// over it is `CompanionReport`'s.
    case live
    /// The channel is open and nothing has ever dialled it.
    case neverDialled
    /// A client held the channel and hung up. The CONVENTION tier stops here
    /// (`CompanionReport.channelClosed`).
    case dropped
    /// There is no channel of Argo's to say anything about — every external Session, every CLI that
    /// takes no plugin, and every Session left by an Argo that is no longer running.
    case notApplicable
}

/// Which claims have had a client on their channel, and what the socket's latest news makes the
/// reading. Beside the enum so the ladder is assertable without binding a socket.
struct CompanionDialLog {
    private var dialled: Set<SessionOwnership.ClaimID> = []

    /// A channel opened for a spawn: there and unreached, which is a state rather than an absence.
    mutating func opened(_ claim: SessionOwnership.ClaimID) -> CompanionLiveness {
        dialled.remove(claim)
        return .neverDialled
    }

    /// Only the LAST peer going is a drop — a relay that reconnects is not a channel that was lost.
    mutating func peers(_ count: Int, of claim: SessionOwnership.ClaimID) -> CompanionLiveness {
        guard count > 0 else { return dialled.contains(claim) ? .dropped : .neverDialled }
        dialled.insert(claim)
        return .live
    }

    /// The channel is gone with its PTY, which is what an orphaned Session's is. One nothing ever
    /// dialled lost nothing, so `dropped` there would name a loss that never happened.
    mutating func closed(_ claim: SessionOwnership.ClaimID) -> CompanionLiveness {
        dialled.remove(claim) != nil ? .dropped : .neverDialled
    }
}
