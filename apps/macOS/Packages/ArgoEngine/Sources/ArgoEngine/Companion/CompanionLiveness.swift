/// Whether one Session's companion channel is up (#493) — four states on the honesty ladder rather
/// than a boolean, because `connected | disconnected` is as few states as #370's
/// `installed | unavailable` was.
///
/// Read off the SOCKET, which Argo owns both ends of: it accepted the dial and the kernel tells it
/// about the hang-up, so every reading here is DIRECT (`CONTEXT.md`, "Honesty tier").
///
/// **Never derived from `managed`-ness.** A Session's posture is about its PTY; this is about a
/// channel that may never have existed — a `codex` claim takes no companion plugin at all
/// (`AgentCLI.takesCompanionPlugin`) — and an orphaned Session that read `live` off its posture
/// would be a false DIRECT.
///
/// **And never derived from silence.** The plugin's MCP server is one long-lived client on the
/// socket, so a channel with nothing to say still holds it open: an agent that is thinking reads
/// `live`. Neither end sends a heartbeat, so "quiet for N seconds" is a threshold nobody could
/// defend — `dropped` is the hang-up, which is news Argo was given.
public enum CompanionLiveness: Equatable, Sendable, CaseIterable {
    /// A client holds the channel, so what the agent reports over it arrives.
    case live
    /// The channel is open and nothing has ever dialled it. A spawn whose CLI has not loaded the
    /// plugin, or has not got that far yet.
    case neverDialled
    /// A client held the channel and hung up. The CONVENTION tier stops here: what the agent says
    /// about itself no longer reaches Argo (`CompanionReport.channelClosed`).
    case dropped
    /// There is no channel of Argo's to say anything about — every external Session, every CLI that
    /// takes no companion plugin, and every Session left by an Argo that is no longer running.
    /// Rendered as nothing rather than as a negative claim.
    case notApplicable
}

/// Which claims have had a client on their channel, and what the socket's latest news makes the
/// reading. Beside the enum rather than inside `CompanionChannel` so the ladder is assertable
/// without binding a socket.
struct CompanionDialLog {
    private var dialled: Set<SessionOwnership.ClaimID> = []

    /// A channel opened for a spawn. Nothing has dialled it yet, which is a state and not an
    /// absence: the socket is there and Argo is listening on it.
    mutating func opened(_ claim: SessionOwnership.ClaimID) -> CompanionLiveness {
        dialled.remove(claim)
        return .neverDialled
    }

    /// How many clients hold the channel now. Only the last one going is a drop — a relay that
    /// reconnects would otherwise read as a channel that had been lost.
    mutating func peers(_ count: Int, of claim: SessionOwnership.ClaimID) -> CompanionLiveness {
        guard count > 0 else { return dialled.contains(claim) ? .dropped : .neverDialled }
        dialled.insert(claim)
        return .live
    }

    /// The channel is gone with its PTY, which is what an orphaned Session's is. A channel nothing
    /// ever dialled lost nothing, so it keeps the reading it had: `dropped` there would name a loss
    /// that never happened.
    mutating func closed(_ claim: SessionOwnership.ClaimID) -> CompanionLiveness {
        dialled.remove(claim) != nil ? .dropped : .neverDialled
    }
}
