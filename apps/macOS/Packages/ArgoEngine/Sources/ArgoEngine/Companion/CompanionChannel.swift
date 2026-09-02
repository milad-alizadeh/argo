import Foundation

/// The companion-plugin channel (CONTEXT.md, "Companion plugin"): one in-process MCP server per
/// managed Session, and the plugin that points its CLI at it.
///
/// This is the only source of the CONVENTION tier, and it is optional: a spawn whose channel never
/// gets a client is still `managed` — Argo owns its PTY — with nothing at that tier to show.
@MainActor
public final class CompanionChannel {
    /// The root every Hub takes its own corner of (`CompanionScope`), one per-claim socket and
    /// plugin directory deep.
    ///
    /// Short and under `/tmp`, not in Application Support, because a `sockaddr_un` path is 103
    /// bytes and "Library/Application Support/Argo/companion" plus a home directory spends most of
    /// them. The directory is the user's alone (0700) and each socket inside it is theirs (0600).
    public static let defaultRoot = URL(
        fileURLWithPath: "/tmp/argo-companion-\(getuid())",
        isDirectory: true,
    )

    private let scope: CompanionScope
    private let onFact: (SessionOwnership.ClaimID, CompanionFact) -> Void
    private let onLiveness: (SessionOwnership.ClaimID, CompanionLiveness) -> Void
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]
    /// Which claims a client has ever held, which is the whole of what `dropped` rests on (#493).
    private var dials = CompanionDialLog()
    /// The last invite that failed, in its refusal's own words; cleared by the next success.
    private var lastRefusal: String?

    /// What the companion row reads (#570): nothing to write outranks a remembered failure.
    var standing: CompanionStanding {
        Self.standing(ships: CompanionPlugin.shipsResources, lastRefusal: lastRefusal)
    }

    /// Called when the Hub re-points: the failure was the old Project's spawn, not the new one's.
    func forgetRefusal() {
        lastRefusal = nil
    }

    static func standing(ships: Bool, lastRefusal: String?) -> CompanionStanding {
        guard ships else { return .missingFromBuild }
        guard let lastRefusal else { return .includedWithSpawns }
        return .installFailed(why: lastRefusal)
    }

    /// `onFact` carries what the agent SAID, at the CONVENTION tier; `onLiveness` carries what the
    /// socket did, at DIRECT. Two callbacks because they are two tiers: folding the channel's own
    /// state into the report would file an observation of Argo's own as something an agent claimed.
    ///
    /// `onFact` is last so a caller with nothing to do about liveness still writes the obvious
    /// trailing closure, and it carries no default: a channel filing no facts serves no tier.
    init(
        scope: CompanionScope,
        onLiveness: @escaping (SessionOwnership.ClaimID, CompanionLiveness) -> Void = { _, _ in },
        onFact: @escaping (SessionOwnership.ClaimID, CompanionFact) -> Void,
    ) {
        self.scope = scope
        self.onFact = onFact
        self.onLiveness = onLiveness
    }

    /// Open this claim's channel and write the plugin that reaches it. `gatedBy` names the
    /// permission gate's socket, when one was opened, so the bundle installs the hook that dials
    /// it — the channel only carries the path; the gate itself is `PermissionChannel`'s.
    func invite(
        _ claim: SessionOwnership.ClaimID,
        gatedBy permissionSocketPath: String? = nil,
    ) throws
        -> CompanionInvitation {
        do {
            let invitation = try open(claim, gatedBy: permissionSocketPath)
            lastRefusal = nil
            return invitation
        } catch {
            lastRefusal = (error as? AgentSpawnError)?.detail ?? error.localizedDescription
            throw error
        }
    }

    private func open(
        _ claim: SessionOwnership.ClaimID,
        gatedBy permissionSocketPath: String?,
    ) throws
        -> CompanionInvitation {
        try scope.createDirectory()
        let socketPath = scope.root.appending(path: "\(claim.value).sock").path
        let invitation = try CompanionPlugin.materialize(
            forClaim: claim,
            under: scope.root,
            socketPath: socketPath,
            gatedBy: permissionSocketPath,
        )
        let endpoint = CompanionEndpoint { [weak self] fact in self?.onFact(claim, fact) }
        let socket = CompanionSocket(path: socketPath) { line in
            guard let request = CompanionRequest(line: line),
                  let reply = endpoint.respond(to: request)
            else { return nil }
            return CompanionResponse.line(reply)
        }
        socket.onPeersChanged = { [weak self] peers in self?.observe(peers: peers, of: claim) }
        try socket.open()
        sockets[claim] = socket
        // Open and unreached: the channel is there and nothing has spoken down it yet, which is a
        // state the cockpit renders rather than an absence it stays quiet about.
        onLiveness(claim, dials.opened(claim))
        return invitation
    }

    /// The PTY is gone, so the channel is too: the socket closes and the plugin that named it goes
    /// with it. Ownership does not come back, and neither does this.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        guard let socket = sockets.removeValue(forKey: claim) else { return }
        socket.close()
        CompanionPlugin.remove(forClaim: claim, under: scope.root)
        // The reading an orphaned Session is left with, and it is `dropped` only where a client had
        // actually dialled in — read off the log, never off the posture.
        onLiveness(claim, dials.closed(claim))
    }

    /// The socket's news, on the ladder. Published on every change rather than remembered here:
    /// the claim ledger is what the roster reads, and a reading filed nowhere is one no surface
    /// draws.
    private func observe(peers: Int, of claim: SessionOwnership.ClaimID) {
        onLiveness(claim, dials.peers(peers, of: claim))
    }
}
