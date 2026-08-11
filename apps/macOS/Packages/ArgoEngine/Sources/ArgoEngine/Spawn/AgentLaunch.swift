import Foundation

/// Everything the process host needs to start one agent: the resolved program, where it runs, what
/// it is passed, and the environment it inherits. Resolved here rather than in the host, so a
/// `claude` missing from this Mac's `PATH` is an answer rather than a child that silently dies.
public struct AgentLaunch: Sendable, Equatable {
    /// Absolute, because the host `execve`s it: a bare name would be an exec failure inside a
    /// forked child, where there is nobody left to tell.
    public let executablePath: String
    public let cwd: String
    public let arguments: [String]
    public let environment: [String: String]

    public init(
        executablePath: String,
        cwd: String,
        arguments: [String] = [],
        environment: [String: String] = [:],
    ) {
        self.executablePath = executablePath
        self.cwd = cwd
        self.arguments = arguments
        self.environment = environment
    }

    /// The environment as `execve` wants it: `KEY=VALUE`, sorted so two identical launches are
    /// identical strings.
    public var environmentStrings: [String] {
        environment.map { "\($0.key)=\($0.value)" }.sorted()
    }

    /// The same launch, opening on a prompt. Last on argv, after the companion's flags — a
    /// positional arriving before a flag's value would be read as that value.
    func opening(_ prompt: String) -> AgentLaunch {
        AgentLaunch(
            executablePath: executablePath,
            cwd: cwd,
            arguments: arguments + [prompt],
            environment: environment,
        )
    }
}
