import Foundation

/// The companion plugin on disk: a standard `.claude-plugin` bundle, written out per claim with
/// that claim's socket baked into it.
///
/// Materialized rather than shipped ready-made: the one thing it must say — which socket to talk
/// down — is not known until the claim exists. The bytes come from the package's own resource, so
/// a checkout and the built app load the same plugin.
enum CompanionPlugin {
    /// Where the socket path goes in the resource's MCP declaration.
    static let socketPlaceholder = "__ARGO_COMPANION_SOCKET__"

    /// Whether this build carries the two plugin resources every spawn writes out.
    ///
    /// `bundle` defaults to the real resolution and is only ever overridden by a test staging a
    /// build with no bundle on disk (#1633) — production code never passes it.
    static func shipsResources(in bundle: Bundle? = ModuleResourceBundle.resolved) -> Bool {
        guard let bundle else { return false }
        return ["plugin", "mcp"].allSatisfy {
            bundle.url(forResource: $0, withExtension: "json", subdirectory: "Plugin") != nil
        }
    }

    /// Write the plugin for one claim under `root`, and say how to reach it.
    ///
    /// Throws rather than returning nothing: a spawn that proceeded without its plugin would be a
    /// managed Session that can never produce a CONVENTION fact.
    ///
    /// `gatedBy` is the permission gate's grant; with one, the bundle also carries the
    /// `PreToolUse` hook and the `hooks/hooks.json` that installs it, which is what makes a spawned
    /// Session's Permissions answerable in the cockpit rather than in a TUI nobody sees.
    static func materialize(
        forClaim claim: SessionOwnership.ClaimID,
        under root: URL,
        socketPath: String,
        gatedBy grant: PermissionGrant? = nil,
        from bundle: Bundle? = ModuleResourceBundle.resolved,
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
        try write(
            resource: "plugin", to: manifestDirectory.appending(path: "plugin.json"), from: bundle,
        )
        let mcpConfig = pluginRoot.appending(path: ".mcp.json")
        try write(
            resource: "mcp", to: mcpConfig, substituting: [socketPlaceholder: socketPath],
            from: bundle,
        )
        return try CompanionInvitation(
            socketPath: socketPath,
            pluginRoot: pluginRoot.path,
            mcpConfigPath: mcpConfig.path,
            hooksPath: grant.map { try gate(in: pluginRoot, grantedBy: $0, from: bundle) },
        )
    }

    /// The hook and the plugin's own `hooks/hooks.json` that installs it. The hook's `timeout` is
    /// `PermissionPatience.hookTimeoutSeconds` — the gate's own patience with a margin on top, so
    /// Argo's answer always arrives before the hook's clock could kill it (#573).
    private static func gate(
        in pluginRoot: URL, grantedBy grant: PermissionGrant, from bundle: Bundle?,
    ) throws
        -> String {
        let hook = pluginRoot.appending(path: "permission-hook.sh")
        try write(
            resource: "permission-hook",
            extension: "sh",
            to: hook,
            substituting: [
                "__ARGO_PERMISSION_SOCKET__": grant.socketPath,
                // The hook's own half of the handshake (#1553): how long it may wait to be told
                // the gate is holding its request, and the word it is told that in.
                "__ARGO_GATE_ACK_SECONDS__": String(grant.acknowledgementSeconds),
                "__ARGO_GATE_HELD__": GateNotice.held,
            ],
            from: bundle,
        )
        let hooksDirectory = pluginRoot.appending(path: "hooks", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(
            at: hooksDirectory,
            withIntermediateDirectories: true,
        )
        let hooks = hooksDirectory.appending(path: "hooks.json")
        try write(resource: "hooks", to: hooks, substituting: [
            "__ARGO_PERMISSION_HOOK__": hook.path,
            "__ARGO_PERMISSION_TIMEOUT__": String(PermissionPatience.hookTimeoutSeconds),
        ], from: bundle)
        return hooks.path
    }

    /// Everything this claim wrote, gone. Called when its PTY dies: the socket is unlinked with it,
    /// so a plugin directory naming one would only ever be a dead end.
    static func remove(forClaim claim: SessionOwnership.ClaimID, under root: URL) {
        try? FileManager.default.removeItem(at: root.appending(path: claim.value))
    }

    private static func write(
        resource: String,
        extension fileExtension: String = "json",
        to url: URL,
        substituting substitutions: [String: String] = [:],
        from bundle: Bundle?,
    ) throws {
        guard let bundle,
              let source = bundle.url(
                  forResource: resource,
                  withExtension: fileExtension,
                  subdirectory: "Plugin",
              ),
              let template = try? String(contentsOf: source, encoding: .utf8)
        else {
            throw AgentSpawnError.hostRefused(detail: "Companion plugin is missing from this build")
        }
        let contents = substitutions.reduce(template) { text, substitution in
            text.replacingOccurrences(of: substitution.key, with: substitution.value)
        }
        try contents.write(to: url, atomically: true, encoding: .utf8)
    }
}
