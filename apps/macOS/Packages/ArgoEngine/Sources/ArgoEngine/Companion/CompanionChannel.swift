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
    /// What `dropped` rests on (#493).
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

    /// Two callbacks because they are two tiers: `onFact` is what the agent SAID (CONVENTION),
    /// `onLiveness` is what the socket DID (DIRECT).
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
        let socket = CompanionSocket(
            path: socketPath,
            onPeersChanged: { [weak self] peers in self?.observe(peers: peers, of: claim) },
            respond: { line in
                guard let request = CompanionRequest(line: line),
                      let reply = endpoint.respond(to: request)
                else { return nil }
                return CompanionResponse.line(reply)
            },
        )
        try socket.open()
        sockets[claim] = socket
        // There and unreached, which the cockpit renders rather than staying quiet about.
        onLiveness(claim, dials.opened(claim))
        return invitation
    }

    /// The PTY is gone, so the channel is too: the socket closes and the plugin that named it goes
    /// with it. Ownership does not come back, and neither does this.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        let channel = sockets.removeValue(forKey: claim)
        channel?.close()
        // Before the guard, and unconditional: an invite whose socket failed to open leaves a
        // plugin directory behind and no socket to find it by.
        CompanionPlugin.remove(forClaim: claim, under: scope.root)
        // A claim that never had a channel gets no reading — filing one would be the false DIRECT.
        guard channel != nil else { return }
        onLiveness(claim, dials.closed(claim))
    }

    /// Published on every change rather than remembered here: the ledger is what the roster reads.
    private func observe(peers: Int, of claim: SessionOwnership.ClaimID) {
        onLiveness(claim, dials.peers(peers, of: claim))
    }
}
