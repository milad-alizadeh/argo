import Foundation

/// Reading which working directories a live CLI is running in — the outside-the-transcript half of
/// `SessionLiveness`.
///
/// A port rather than a direct call to `ps`, so what the Hub makes of liveness is falsifiable
/// without a process table to arrange: the same shape `CheckoutRead` gives the git read.
public typealias LivenessRead = @Sendable () async -> Set<String>

/// The app's adapter: the process table, read through subprocesses. One reader for the process, so
/// the blocking calls queue behind one another rather than running a `ps` per caller.
public let processLivenessRead: LivenessRead = {
    await processLivenessReader.liveCwds()
}

private let processLivenessReader = ProcessLivenessReader()

/// Best-effort, and deliberately so. Any failure — no `ps`, no `lsof`, a locked-down host — answers
/// with nothing, so liveness resolves down to quiet rather than up to a running Argo never saw.
actor ProcessLivenessReader {
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
                  let command = fields.dropFirst().first, isAgentCommand(String(command))
            else { return nil }
            return String(pid)
        }
    }

    private func isAgentCommand(_ command: String) -> Bool {
        command == ProcessLivenessReader.agentExecutable
            || command.hasSuffix("/" + ProcessLivenessReader.agentExecutable)
    }

    /// The CLI whose Sessions this engine reads. One name, because `Session.cli` is not yet a fact
    /// the discovery half establishes — a second CLI is a second entry here, never a looser match.
    static let agentExecutable = "claude"

    /// `lsof -Fn` answers in fields, one per line, each prefixed by its letter. The `n` field of a
    /// `cwd` descriptor is the folder the process is running in.
    private func cwd(ofPID pid: String) -> String? {
        guard let answer = run(["lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"]) else { return nil }
        return answer.split(whereSeparator: \.isNewline)
            .first { $0.hasPrefix("n") }
            .map { String($0.dropFirst()) }
    }
}

/// One command run through the user's `PATH`: its stdout verbatim, or `nil` where it answered
/// nothing at all — no such tool, a non-zero exit.
typealias ShellCommand = @Sendable ([String]) -> String?

let shellCommand: ShellCommand = { arguments in
    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = arguments
    process.standardOutput = output
    process.standardError = FileHandle.nullDevice
    guard (try? process.run()) != nil else { return nil }
    let data = output.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else { return nil }
    return String(data: data, encoding: .utf8)
}
