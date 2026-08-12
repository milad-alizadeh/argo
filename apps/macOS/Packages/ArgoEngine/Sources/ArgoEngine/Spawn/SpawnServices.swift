import Foundation

/// Everything the Hub needs to start an agent of its own, in one value. A Hub with no process host
/// cannot spawn — the honest state for the render harness and for every test about observation.
@MainActor
public struct SpawnServices {
    public let host: AgentProcessHost?
    /// What starts a `codex app-server`, where the engine's own pipe host is not what should run —
    /// a suite that must not launch a real CLI. `nil` takes `CodexProcessHost`, which is what the
    /// app wants and what needs no window.
    public let codexHost: AgentProcessHost?
    public let launcher: AgentLauncher
    /// Where the companion channel writes its sockets and plugin directories.
    public let companionRoot: URL
    /// Where the handoff chain is remembered. `nil` remembers nothing — a test or render harness
    /// that named no folder must not read or write the machine's own file.
    public let chainFileURL: URL?
    /// Where the Sessions Argo has owned a PTY for are remembered (ADR-0026). `nil` remembers
    /// nothing, for the reason `chainFileURL` does — and then every Session grades `external`
    /// after a relaunch, which is the reading Argo had before the file existed.
    public let ownershipFileURL: URL?
    /// Where the rung the user last picked is remembered (#629). `nil` remembers nothing, for the
    /// reason `chainFileURL` does — and then every New Session opens on `Code`, which is the
    /// baseline Argo spawned on before this file existed.
    public let modeFileURL: URL?
    /// How long the permission gate waits for a person before refusing the call itself (#573).
    /// Live everywhere but a test that has to reach the far end of a day-long wait.
    public let permissionPatience: PermissionPatience

    public init(
        host: AgentProcessHost?,
        codexHost: AgentProcessHost? = nil,
        launcher: AgentLauncher = AgentLauncher(),
        companionRoot: URL = CompanionChannel.defaultRoot,
        chainFileURL: URL? = nil,
        ownershipFileURL: URL? = nil,
        modeFileURL: URL? = nil,
        permissionPatience: PermissionPatience = .default,
    ) {
        self.host = host
        self.codexHost = codexHost
        self.launcher = launcher
        self.companionRoot = companionRoot
        self.chainFileURL = chainFileURL
        self.ownershipFileURL = ownershipFileURL
        self.modeFileURL = modeFileURL
        self.permissionPatience = permissionPatience
    }

    /// A Hub that observes and never spawns.
    public static let none = SpawnServices(host: nil)
}
