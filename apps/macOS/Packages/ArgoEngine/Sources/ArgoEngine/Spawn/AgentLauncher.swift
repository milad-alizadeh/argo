import Foundation

/// Turns "run this CLI in this folder" into a launch the process host can execute.
///
/// An actor because it shells out to the user's login shell to find out what their `PATH` really
/// is, and that read must not happen on the main actor. It happens once: a `PATH` is not something
/// that changes while a window is open, and paying for it per spawn would be felt.
public actor AgentLauncher {
    private let run: ShellCommand
    private let inherited: [String: String]
    private var searchPath: String?

    public init() {
        self.run = shellCommand
        self.inherited = ProcessInfo.processInfo.environment
    }

    /// The shell is a seam so a test can answer for it: what the user's `PATH` is cannot be
    /// asserted about the machine running the suite. The environment is one for the same reason —
    /// what this process was started with is a property of whoever launched Argo.
    init(run: @escaping ShellCommand, inherited: [String: String] = [:]) {
        self.run = run
        self.inherited = inherited
    }

    /// Throws `AgentSpawnError` for everything the user can act on — the CLI missing from their
    /// `PATH` above all, which is the commonest spawn failure there is and reads as nothing
    /// happening unless it is said out loud (#361).
    public func launch(
        cli: AgentCLI,
        cwd: String,
        companion: CompanionInvitation?,
    ) throws
        -> AgentLaunch {
        let searchPath = resolvedSearchPath()
        guard let executablePath = AgentExecutable.locate(cli.command, on: searchPath) else {
            throw AgentSpawnError.executableNotFound(command: cli.command)
        }
        return AgentLaunch(
            executablePath: executablePath,
            cwd: cwd,
            arguments: companion?.arguments ?? [],
            environment: environment(searchPath: searchPath, companion: companion),
        )
    }

    /// Variables that are true of Argo and false of every agent Argo starts.
    ///
    /// `CLAUDE_CODE_CHILD_SESSION` is set in the environment of a `claude` running under another
    /// one, and a `claude` that reads it writes no transcript of its own. Argo is very often
    /// itself such a child — it is developed from inside a Session — so a spawn that passed this
    /// through would produce the one Session no observation could ever reach: a live PTY with no
    /// record behind it, permanently `unknown` in the roster.
    private static let inheritedByNobody = ["CLAUDE_CODE_CHILD_SESSION"]

    private func resolvedSearchPath() -> String {
        if let searchPath {
            return searchPath
        }
        let resolved = LoginShellPath.resolved(run)
        searchPath = resolved
        return resolved
    }

    /// This process's environment with the shell's `PATH` over the top, plus the channel's own
    /// variables. Inherited rather than built: an agent needs the user's whole environment —
    /// credentials, proxies, `mise` shims — and a hand-picked subset would break a machine at a
    /// time.
    ///
    /// Scrubbed, therefore, rather than filtered: everything comes through except the variables
    /// that describe the process ARGO is, which are never true of the child it starts.
    private func environment(
        searchPath: String,
        companion: CompanionInvitation?,
    )
        -> [String: String] {
        var environment = inherited
        for key in Self.inheritedByNobody {
            environment.removeValue(forKey: key)
        }
        environment["PATH"] = searchPath
        // The PTY is a real terminal, and an agent told otherwise draws for a dumb one.
        environment["TERM"] = "xterm-256color"
        for (key, value) in companion?.environment ?? [:] {
            environment[key] = value
        }
        return environment
    }
}
