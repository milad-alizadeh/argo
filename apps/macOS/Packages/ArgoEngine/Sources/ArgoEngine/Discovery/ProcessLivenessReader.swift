/// Which working directories an agent CLI is running in, read off the process table.
///
/// Best-effort, and deliberately so. Any failure — no `ps`, no `lsof`, a locked-down host — answers
/// with nothing, so liveness resolves down to quiet rather than up to a running Argo never saw.
///
/// An actor because the reads block on subprocesses and the caller is the main actor.
actor ProcessLivenessReader {
    /// The CLIs whose Sessions this engine reads, by the name each is found on the `PATH` under.
    /// Every CLI a spawn can run, taken off `AgentCLI` rather than written out — a program absent
    /// here can never match, so a Session on it reads quiet however hard it is working (#1261).
    ///
    /// A NAME and not a path: an executable called `claude` somewhere else on disk matches too.
    /// That is as tight as a process table read gets, and the honest floor under it is that a
    /// match alone never says a Session is live (`SessionLiveness`).
    static let agentExecutables = Set(AgentCLI.allCases.map(\.command))

    private let run: ShellCommand

    init(run: @escaping ShellCommand = shellCommand) {
        self.run = run
    }

    func liveCwds() -> Set<String> {
        Set(agentPIDs().compactMap(cwd(ofPID:)))
    }

    /// Matches an agent executable itself, not any command line that merely CONTAINS the word — a
    /// path under `~/.claude`, or Argo's own arguments — which would manufacture a false running.
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

    /// The program is the LAST component of what it was launched by, so `/opt/homebrew/bin/claude`
    /// is `claude` and `node …/cli.js` is `node`.
    private func isAgent(command: String) -> Bool {
        let program = command.split(separator: "/").last.map(String.init) ?? command
        return Self.agentExecutables.contains(program)
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
