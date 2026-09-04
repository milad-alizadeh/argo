import Foundation

/// Everything the Hub needs to start an agent of its own, in one value. A Hub with no process host
/// cannot spawn — the honest state for the render harness and for every test about observation.
@MainActor
public struct SpawnServices {
    /// The four files a spawn remembers things in, grouped because they are named together and
    /// defaulted together: a test or render harness that names none of them must read and write
    /// none of the machine's own (#755).
    public struct Files: Sendable {
        /// Where the handoff chain is remembered. `nil` remembers nothing.
        public let chainFileURL: URL?
        /// Where the Sessions Argo has owned a PTY for are remembered (ADR-0026). `nil` remembers
        /// nothing, and then every Session grades `external` after a relaunch, which is the reading
        /// Argo had before the file existed.
        public let ownershipFileURL: URL?
        /// Where the rung the user last picked is remembered (#629). `nil` remembers nothing, and
        /// then every New Session opens on `Code`, which is the baseline Argo spawned on before
        /// this file existed.
        public let modeFileURL: URL?
        /// Where the Model and Effort the user last picked are remembered (#1175). `nil` remembers
        /// nothing, and then every New Session opens on `Opus 5 · Medium`, which is where one opens
        /// with nothing ever picked.
        public let runFileURL: URL?

        public init(
            chainFileURL: URL? = nil,
            ownershipFileURL: URL? = nil,
            modeFileURL: URL? = nil,
            runFileURL: URL? = nil,
        ) {
            self.chainFileURL = chainFileURL
            self.ownershipFileURL = ownershipFileURL
            self.modeFileURL = modeFileURL
            self.runFileURL = runFileURL
        }
    }

    /// The two waits a spawn's own machinery runs, grouped for the reason the files are: both are
    /// live everywhere but a suite that has to reach the far end of one.
    public struct Patience: Sendable {
        /// How long the permission gate waits for a person before refusing the call itself (#573).
        public let permission: PermissionPatience
        /// How long a spawn waits for its CLI's first byte before it stops reading `starting`
        /// (#1245).
        public let startup: StartupPatience

        public init(
            permission: PermissionPatience = .default,
            startup: StartupPatience = .default,
        ) {
            self.permission = permission
            self.startup = startup
        }
    }

    public let host: AgentProcessHost?
    /// What starts a `codex app-server`, where the engine's own pipe host is not what should run —
    /// a suite that must not launch a real CLI. `nil` takes `CodexProcessHost`, which is what the
    /// app wants and what needs no window.
    public let codexHost: AgentProcessHost?
    public let launcher: AgentLauncher
    /// Where the companion channel writes its sockets and plugin directories. Beside the files
    /// above rather than in them: it is a directory Argo owns and always has one, where each of
    /// those is a file it may be told to keep nothing in.
    public let companionRoot: URL
    public let files: Files
    public let patience: Patience
    /// The transcript id a fresh spawn tells its CLI to write under (#742). Injected so a test can
    /// stand in for the CLI's own record under a name it knows: the id is on argv and in the claim,
    /// and a test that could not predict it would have to read one to assert the other.
    public let mintTranscriptID: @MainActor () -> String

    public init(
        host: AgentProcessHost?,
        codexHost: AgentProcessHost? = nil,
        launcher: AgentLauncher = AgentLauncher(),
        companionRoot: URL = CompanionChannel.defaultRoot,
        files: Files = Files(),
        patience: Patience = Patience(),
        mintTranscriptID: @MainActor @escaping () -> String = { UUID().uuidString.lowercased() },
    ) {
        self.host = host
        self.codexHost = codexHost
        self.launcher = launcher
        self.companionRoot = companionRoot
        self.files = files
        self.patience = patience
        self.mintTranscriptID = mintTranscriptID
    }

    /// A Hub that observes and never spawns.
    public static let none = SpawnServices(host: nil)
}
