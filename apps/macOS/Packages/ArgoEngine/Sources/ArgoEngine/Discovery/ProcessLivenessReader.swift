/// Which working directories an agent CLI is running in, read off the process table.
///
/// Best-effort, and deliberately so. Any failure — no `ps`, no `lsof`, a locked-down host — answers
/// with nothing, so liveness resolves down to quiet rather than up to a running Argo never saw.
///
/// An actor because the reads block on subprocesses and the caller is the main actor.
actor ProcessLivenessReader {
    /// The CLI whose Sessions this engine reads. One name, because `Session.cli` is not yet a fact
    /// the discovery half establishes — a second CLI is a second entry here, never a looser match.
    static let agentExecutable = "claude"

    private let run: ShellCommand

    init(run: @escaping ShellCommand = shellCommand) {
        self.run = run
    }

    func liveCwds() -> Set<String> {
        Set(agentPIDs().compactMap(cwd(ofPID:)))
    }

    /// Matches the `claude` executable itself, not any command line that merely CONTAINS the word —
    /// a path under `~/.claude`, or Argo's own arguments — which would manufacture a false running.
    private func agentPIDs() -> [String] {
        guard let table = run(["ps", "-axo", "pid=,command="]) else { return [] }
        return table.split(whereSeparator: \.isNewline).compactMap { line in
            let fields = line.split(separator: " ", omittingEmptySubsequences: true)
            guard let pid = fields.first, pid.allSatisfy(\.isNumber),
                  let command = fields.dropFirst().first, isAgent(command: String(command))
            else { return nil }
            return String(pid)
        }
    }

    private func isAgent(command: String) -> Bool {
        command == Self.agentExecutable || command.hasSuffix("/" + Self.agentExecutable)
    }

    /// `lsof -Fn` answers in fields, one per line, each prefixed by its letter. The `n` field of a
    /// `cwd` descriptor is the folder the process is running in, with its symlinks already
    /// resolved.
    private func cwd(ofPID pid: String) -> String? {
        guard let answer = run(["lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"]) else { return nil }
        return answer.split(whereSeparator: \.isNewline)
            .first { $0.hasPrefix("n") }
            .map { String($0.dropFirst()) }
    }
}
