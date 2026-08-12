import Foundation

/// Turns "run this CLI in this folder" into a launch the process host can execute.
///
/// An actor because it shells out to the user's login shell to find out what their `PATH` really
/// is, and that read must not happen on the main actor. It happens once: a `PATH` does not change
/// while a window is open.
public actor AgentLauncher {
    private let run: ShellCommand
    private let inherited: [String: String]
    private var searchPath: String?

    public init() {
        self.run = shellCommand
        self.inherited = ProcessInfo.processInfo.environment
    }

    /// The shell and the environment are seams so a test can answer for them: neither the user's
    /// `PATH` nor what this process was started with is assertable about the machine running it.
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
            environment: environment(searchPath: searchPath, cli: cli, companion: companion),
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
    /// variables, less what this CLI must not inherit (`AgentCLI.scrubbedFromEnvironment`).
    /// Inherited rather than built: an agent needs the user's whole environment — credentials,
    /// proxies, `mise` shims — and a hand-picked subset would break a machine at a time.
    private func environment(
        searchPath: String,
        cli: AgentCLI,
        companion: CompanionInvitation?,
    )
        -> [String: String] {
        var environment = inherited
        for key in cli.scrubbedFromEnvironment {
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
