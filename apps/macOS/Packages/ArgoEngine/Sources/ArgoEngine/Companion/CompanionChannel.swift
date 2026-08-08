import Foundation

/// The companion-plugin channel (CONTEXT.md, "Companion plugin"): one in-process MCP server per
/// managed Session, and the plugin that points its CLI at it.
///
/// This is the only source of the CONVENTION tier. It is also, deliberately, optional: a spawn
/// whose channel never gets a client is still `managed` — Argo owns its PTY, which is what the
/// posture is about — and simply has nothing at that tier to show.
@MainActor
public final class CompanionChannel {
    /// Where the per-claim sockets and plugin directories live.
    ///
    /// Short and under `/tmp`, not in Application Support with the Project registry, because a
    /// `sockaddr_un` path is 103 bytes and "Library/Application Support/Argo/companion" plus a home
    /// directory spends most of them. This is runtime state that dies with the PTY, not owned state
    /// worth keeping, so the tighter place is also the right one. The directory is the user's alone
    /// (0700) and each socket inside it is theirs (0600).
    public static let defaultRoot = URL(
        fileURLWithPath: "/tmp/argo-companion-\(getuid())",
        isDirectory: true,
    )

    private let root: URL
    private let onFact: (SessionOwnership.ClaimID, CompanionFact) -> Void
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]

    init(
        root: URL = CompanionChannel.defaultRoot,
        onFact: @escaping (SessionOwnership.ClaimID, CompanionFact) -> Void,
    ) {
        self.root = root
        self.onFact = onFact
    }

    /// Open this claim's channel and write the plugin that reaches it.
    func invite(_ claim: SessionOwnership.ClaimID) throws -> CompanionInvitation {
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

    /// Every channel, closed. What app quit calls, beside the PTYs themselves.
    func withdrawAll() {
        for claim in sockets.keys {
            withdraw(claim)
        }
    }
}
