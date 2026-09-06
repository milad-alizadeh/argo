import Foundation

/// The backlog-question port, over `codex exec`.
///
/// **The transport is `codex exec` because of the billing, not the ergonomics** (ADR-0031).
/// `claude -p` and the Agent SDK meter every token; Codex's ChatGPT sign-in covers `codex exec` as
/// it covers the TUI, and Codex splits its billing on the credential rather than the surface
/// (ADR-0024). Nothing on this path can reach a metered endpoint: the sign-in is checked to be a
/// ChatGPT one before the process starts, `OPENAI_API_KEY` is scrubbed out of its environment, and
/// `--ignore-user-config` keeps a local `config.toml` from naming another provider.
///
/// Measured over a 40-ticket fixture on 2026-09-05: 5.2s at best of six, ~6s typical, 11.4s at
/// worst — not the 2.4s the design drew.
public struct CodexBacklogAsk: BacklogAskPort {
    /// How long a reader is made to wait before the wait itself becomes the answer. Four times the
    /// typical measured 6s, so ordinary variance never trips it and a hung CLI does.
    public static let patience = Duration.seconds(25)

    private let home: URL
    private let searchPath: String

    /// The one this machine has: the CLI's own `CODEX_HOME`, on the `PATH` the user's shell gives.
    public init() {
        self.init(home: CodexSignInReader.home(), searchPath: LoginShellPath.resolved())
    }

    /// Both named, for a suite that points at a sign-in and a `PATH` it wrote itself.
    init(home: URL, searchPath: String) {
        self.home = home
        self.searchPath = searchPath
    }

    public func answer(_ question: String, over tickets: [Ticket]) async -> Result<
        BacklogAnswer, BacklogAskRefusal,
    > {
        do {
            let signIn = try CodexSignInReader.read(in: home)
            guard let executable = AgentExecutable.locate("codex", on: searchPath) else {
                return .failure(.noCLI(detail: "Codex is not installed on this Mac"))
            }
            let prompt = BacklogAskPrompt.text(question: question, tickets: tickets)
            let clock = ContinuousClock()
            var took = Duration.zero
            let prose = try await clock.measure(&took) {
                try await run(executable, prompt: prompt)
            }
            return .success(BacklogAnswer(prose: prose, answeredBy: signIn, took: took))
        } catch let refusal as BacklogAskRefusal {
            return .failure(refusal)
        } catch {
            return .failure(.refused(detail: "Codex could not be asked: \(error)"))
        }
    }

    private func run(_ executable: String, prompt: String) async throws -> String {
        let run = try CodexExecRun()
        defer { run.clean() }
        try prompt.write(to: run.prompt, atomically: true, encoding: .utf8)
        let exitCode = try await CodexExecProcess(
            run: run,
            executable: executable,
            searchPath: searchPath,
        ).wait(Self.patience)
        return try run.result(exitCode: exitCode).get()
    }
}

private extension ContinuousClock {
    /// The block's value and how long it took, since `measure` itself hands back only the duration.
    func measure<T>(_ took: inout Duration, _ work: () async throws -> T) async rethrows -> T {
        let started = now
        let value = try await work()
        took = now - started
        return value
    }
}
