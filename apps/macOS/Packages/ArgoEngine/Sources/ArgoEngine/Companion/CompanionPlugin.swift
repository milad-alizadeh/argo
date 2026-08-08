import Foundation

/// The companion plugin on disk: a standard `.claude-plugin` bundle, written out per claim with
/// that claim's socket baked into it.
///
/// Materialized rather than shipped ready-made because the one thing it must say — which socket to
/// talk down — is not known until the claim exists. The bytes come from the package's own resource,
/// so a checkout and the built app load the same plugin.
enum CompanionPlugin {
    /// Where the socket path goes in the resource's MCP declaration.
    static let socketPlaceholder = "__ARGO_COMPANION_SOCKET__"

    /// Write the plugin for one claim under `root`, and say how to reach it.
    ///
    /// Throws rather than returning nothing: a spawn that proceeded without its plugin would be a
    /// managed Session that can never produce a CONVENTION fact, and saying so is better than
    /// leaving the reader to wonder why the tier never appears.
    static func materialize(
        forClaim claim: SessionOwnership.ClaimID,
        under root: URL,
        socketPath: String,
    ) throws
        -> CompanionInvitation {
        let pluginRoot = root.appending(path: claim.value, directoryHint: .isDirectory)
        let manifestDirectory = pluginRoot.appending(
            path: ".claude-plugin",
            directoryHint: .isDirectory,
        )
        try FileManager.default.createDirectory(
            at: manifestDirectory,
            withIntermediateDirectories: true,
        )
        try write(resource: "plugin", to: manifestDirectory.appending(path: "plugin.json"))
        let mcpConfig = pluginRoot.appending(path: ".mcp.json")
        try write(resource: "mcp", to: mcpConfig, substituting: socketPath)
        return CompanionInvitation(
            socketPath: socketPath,
            pluginRoot: pluginRoot.path,
            mcpConfigPath: mcpConfig.path,
        )
    }

    /// Everything this claim wrote, gone. Called when its PTY dies: the socket is unlinked with it,
    /// so a plugin directory naming one would only ever be a dead end.
    static func remove(forClaim claim: SessionOwnership.ClaimID, under root: URL) {
        try? FileManager.default.removeItem(at: root.appending(path: claim.value))
    }

    private static func write(
        resource: String,
        to url: URL,
        substituting socketPath: String? = nil,
    ) throws {
        guard let source = Bundle.module.url(
            forResource: resource,
            withExtension: "json",
            subdirectory: "Plugin",
        ),
            let template = try? String(contentsOf: source, encoding: .utf8)
        else {
            throw AgentSpawnError.hostRefused(detail: "Companion plugin is missing from this build")
        }
        let contents = socketPath.map {
            template.replacingOccurrences(of: socketPlaceholder, with: $0)
        } ?? template
        try contents.write(to: url, atomically: true, encoding: .utf8)
    }
}
