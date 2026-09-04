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
    /// Where the Model and Effort the user last picked are remembered (#1175). `nil` remembers
    /// nothing, for the reason `modeFileURL` does — and then every New Session opens on
    /// `Opus 5 · Medium`, which is where one opens with nothing ever picked.
    public let runFileURL: URL?
    /// How long the permission gate waits for a person before refusing the call itself (#573).
    /// Live everywhere but a test that has to reach the far end of a day-long wait.
    public let permissionPatience: PermissionPatience
    /// The transcript id a fresh spawn tells its CLI to write under (#742). Injected so a test can
    /// stand in for the CLI's own record under a name it knows: the id is on argv and in the claim,
    /// and a test that could not predict it would have to read one to assert the other.
    public let mintTranscriptID: @MainActor () -> String

    public init(
        host: AgentProcessHost?,
        codexHost: AgentProcessHost? = nil,
        launcher: AgentLauncher = AgentLauncher(),
        companionRoot: URL = CompanionChannel.defaultRoot,
        chainFileURL: URL? = nil,
        ownershipFileURL: URL? = nil,
        modeFileURL: URL? = nil,
        runFileURL: URL? = nil,
        permissionPatience: PermissionPatience = .default,
        mintTranscriptID: @MainActor @escaping () -> String = { UUID().uuidString.lowercased() },
    ) {
        self.host = host
        self.codexHost = codexHost
        self.launcher = launcher
        self.companionRoot = companionRoot
        self.chainFileURL = chainFileURL
        self.ownershipFileURL = ownershipFileURL
        self.modeFileURL = modeFileURL
        self.runFileURL = runFileURL
        self.permissionPatience = permissionPatience
        self.mintTranscriptID = mintTranscriptID
    }

    /// A Hub that observes and never spawns.
    public static let none = SpawnServices(host: nil)
}
