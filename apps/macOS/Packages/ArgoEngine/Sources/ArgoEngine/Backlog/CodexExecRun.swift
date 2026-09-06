import Foundation

/// One `codex exec` run, and everything about it that is a file rather than a pipe.
///
/// **Files on both ends, not pipes.** The prompt is a whole backlog and the log is whatever the CLI
/// felt like printing, and a pipe either side fills its buffer and stalls the child while this side
/// waits for an exit that cannot come. A scratch directory costs one `mkdir` and cannot deadlock.
///
/// It doubles as the sandbox's working root: `codex exec` runs read-only in it, and it holds
/// nothing, so a model that ignored the prompt and went looking would find no repository to read.
struct CodexExecRun {
    let directory: URL

    init() throws(BacklogAskRefusal) {
        self.directory = FileManager.default.temporaryDirectory
            .appending(path: "argo-backlog-ask-\(UUID().uuidString)")
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
            )
        } catch {
            throw .refused(detail: "Argo could not open a scratch directory for the question")
        }
    }

    var prompt: URL {
        directory.appending(path: "prompt.txt")
    }

    var answer: URL {
        directory.appending(path: "answer.txt")
    }

    var log: URL {
        directory.appending(path: "log.txt")
    }

    /// The invocation (ADR-0031). Two flags a reader would otherwise remove as noise:
    /// `--ignore-user-config` is what stops a local `config.toml` naming a metered provider, and
    /// auth still comes from `CODEX_HOME` without it; `-` reads the prompt from stdin because a
    /// backlog on argv is an argument list long enough for the kernel to refuse.
    ///
    /// Verified against `codex-cli` 0.147.0 on 2026-09-05.
    var arguments: [String] {
        [
            "exec", "--ephemeral", "--ignore-user-config", "--skip-git-repo-check",
            "--sandbox", "read-only", "--color", "never",
            "--cd", directory.path, "--output-last-message", answer.path, "-",
        ]
    }

    /// The environment the CLI is handed: the user's own, minus what would meter it.
    ///
    /// `AgentCLI.codex.scrubbedFromEnvironment` is the same list a spawned Codex Session is cleaned
    /// with (ADR-0024) — one rule, read from where it already lives, so a key added there covers
    /// this path the day it is added.
    /// `inherited` is a parameter so the scrub can be asserted against an environment a test wrote
    /// — a guard whose only proof is the machine it happened to run on is a guard nobody checked.
    static func environment(
        path: String,
        inheriting inherited: [String: String] = ProcessInfo.processInfo.environment,
    )
        -> [String: String] {
        var environment = inherited
        for name in AgentCLI.codex.scrubbedFromEnvironment {
            environment.removeValue(forKey: name)
        }
        environment["PATH"] = path
        return environment
    }

    /// What the model finally said, or the refusal saying why there is nothing.
    func result(exitCode: Int32) -> Result<String, BacklogAskRefusal> {
        let prose = (try? String(contentsOf: answer, encoding: .utf8))?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard exitCode == 0 else {
            return .failure(.refused(detail: "Codex exited \(exitCode): \(tail)"))
        }
        // An exit of 0 with nothing written is the shape this port exists to catch: the reader
        // would otherwise be shown a blank sheet and read it as an answer about the backlog.
        guard !prose.isEmpty else {
            return .failure(.refused(detail: "Codex answered nothing: \(tail)"))
        }
        return .success(prose)
    }

    /// The last of the CLI's own output, for a refusal that says something. Bounded because the log
    /// is unbounded and a sentence is what the surface draws.
    private var tail: String {
        let log = (try? String(contentsOf: log, encoding: .utf8)) ?? ""
        let lines = log.split(whereSeparator: \.isNewline).suffix(3)
        return lines.isEmpty ? "it printed nothing" : lines.joined(separator: " · ")
    }

    func clean() {
        try? FileManager.default.removeItem(at: directory)
    }
}
