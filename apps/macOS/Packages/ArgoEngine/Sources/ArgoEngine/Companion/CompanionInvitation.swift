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
    /// The plugin's MCP declaration, passed on argv as well.
    ///
    /// The same file serves both: `.mcp.json` is what a plugin installed from a marketplace is
    /// loaded through, and `--mcp-config` is how this spawn loads the identical document without
    /// one standing between them.
    public let mcpConfigPath: String

    public init(socketPath: String, pluginRoot: String, mcpConfigPath: String) {
        self.socketPath = socketPath
        self.pluginRoot = pluginRoot
        self.mcpConfigPath = mcpConfigPath
    }

    var arguments: [String] {
        ["--mcp-config", mcpConfigPath]
    }

    var environment: [String: String] {
        ["ARGO_COMPANION_SOCKET": socketPath, "CLAUDE_PLUGIN_ROOT": pluginRoot]
    }
}
