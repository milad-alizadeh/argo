import Foundation

/// The companion-plugin channel (CONTEXT.md, "Companion plugin"): one in-process MCP server per
/// managed Session, and the plugin that points its CLI at it.
///
/// This is the only source of the CONVENTION tier, and it is optional: a spawn whose channel never
/// gets a client is still `managed` — Argo owns its PTY — with nothing at that tier to show.
@MainActor
public final class CompanionChannel {
    /// Where the per-claim sockets and plugin directories live.
    ///
    /// Short and under `/tmp`, not in Application Support, because a `sockaddr_un` path is 103
    /// bytes
    /// and "Library/Application Support/Argo/companion" plus a home directory spends most of them.
    /// The directory is the user's alone (0700) and each socket inside it is theirs (0600).
    public static let defaultRoot = URL(
        fileURLWithPath: "/tmp/argo-companion-\(getuid())",
        isDirectory: true,
    )

    private let root: URL
    private let onFact: (SessionOwnership.ClaimID, CompanionFact) -> Void
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]
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

    init(
        root: URL = CompanionChannel.defaultRoot,
        onFact: @escaping (SessionOwnership.ClaimID, CompanionFact) -> Void,
    ) {
        self.root = root
        self.onFact = onFact
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
        try FileManager.default.createDirectory(
            at: root,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700],
        )
        let socketPath = root.appending(path: "\(claim.value).sock").path
        let invitation = try CompanionPlugin.materialize(
            forClaim: claim,
            under: root,
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
        try socket.open()
        sockets[claim] = socket
        return invitation
    }

    /// The PTY is gone, so the channel is too: the socket closes and the plugin that named it goes
    /// with it. Ownership does not come back, and neither does this.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        sockets.removeValue(forKey: claim)?.close()
        CompanionPlugin.remove(forClaim: claim, under: root)
    }
}
