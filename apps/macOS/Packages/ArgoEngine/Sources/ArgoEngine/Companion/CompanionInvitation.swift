import Foundation

/// What one spawn is handed so its CLI can find Argo: the socket to talk down, and the plugin that
/// tells it how.
///
/// Per claim, not per app: the socket path IS the capability, so two agents in one folder cannot
/// report as each other.
public struct CompanionInvitation: Sendable, Equatable {
    public let socketPath: String
    /// The materialized plugin's root — a real `.claude-plugin` directory, which is what makes this
    /// the companion PLUGIN rather than a bare MCP server.
    public let pluginRoot: String
    /// The plugin's MCP declaration, which is also what is passed on argv.
    ///
    /// `--mcp-config`, not `--plugin-dir`. Both were tried against the real CLI: `--mcp-config`
    /// registers the server (`mcp__argo__report_status` appears and the socket receives
    /// `initialize`), while `--plugin-dir` over this same directory registers nothing — an
    /// uninstalled plugin directory's `.mcp.json` is not read. The bundle around it is still the
    /// artifact a marketplace would install (#6); today the flag is what does the work.
    public let mcpConfigPath: String
    /// The plugin's `hooks/hooks.json`, which installs the `PreToolUse` permission hook. Absent
    /// when no gate was opened, which spawns the session exactly as before.
    ///
    /// It is the plugin that carries the hook, and `--plugin-dir` that loads it. `--settings` was
    /// tried first and does NOT do this: against claude 2.1.226 a settings file passed on argv
    /// leaves `/hooks` showing the same count it showed without one, and a gated call runs
    /// unstopped — the hook that would have asked was never registered, and an unregistered hook
    /// fails silently open. `--plugin-dir` registers it, which is why both flags are passed:
    /// `--mcp-config` for the companion server, `--plugin-dir` for the gate.
    public let hooksPath: String?

    public init(
        socketPath: String,
        pluginRoot: String,
        mcpConfigPath: String,
        hooksPath: String? = nil,
    ) {
        self.socketPath = socketPath
        self.pluginRoot = pluginRoot
        self.mcpConfigPath = mcpConfigPath
        self.hooksPath = hooksPath
    }

    var arguments: [String] {
        ["--mcp-config", mcpConfigPath]
            + (hooksPath == nil ? [] : ["--plugin-dir", pluginRoot])
    }

    var environment: [String: String] {
        ["ARGO_COMPANION_SOCKET": socketPath, "CLAUDE_PLUGIN_ROOT": pluginRoot]
    }
}
