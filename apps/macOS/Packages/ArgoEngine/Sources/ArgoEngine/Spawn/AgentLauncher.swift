import Foundation

/// Turns "run this CLI in this folder" into a launch the process host can execute.
///
/// An actor because it shells out to the user's login shell to find out what their `PATH` really
/// is, and that read must not happen on the main actor. It happens once: a `PATH` is not something
/// that changes while a window is open, and paying for it per spawn would be felt.
public actor AgentLauncher {
    private let run: ShellCommand
    private var searchPath: String?

    public init() {
        self.run = shellCommand
    }

    /// The shell is a seam so a test can answer for it: what the user's `PATH` is cannot be
    /// asserted about the machine running the suite.
    init(run: @escaping ShellCommand) {
        self.run = run
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
    private func environment(
        searchPath: String,
        companion: CompanionInvitation?,
    )
        -> [String: String] {
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = searchPath
        // The PTY is a real terminal, and an agent told otherwise draws for a dumb one.
        environment["TERM"] = "xterm-256color"
        for (key, value) in companion?.environment ?? [:] {
            environment[key] = value
        }
        return environment
    }
}
