import Foundation

/// The backlog-question port, over `codex exec` (ADR-0031).
///
/// Nothing on this path can reach a metered endpoint: an `auth.json` holding an API key is refused
/// before the process starts, `OPENAI_API_KEY` is scrubbed out of the child's environment with
/// ADR-0024's own list, and `--ignore-user-config` keeps a local `config.toml` from naming another
/// provider.
///
/// Measured over the nine-ticket fixture on 2026-09-05, three runs: least 4403–4457 ms, median
/// 4717–5033 ms. Over 40 of this repo's real open issues: 5.2 s least, 11.4 s worst.
struct CodexBacklogAsk: BacklogAskPort {
    /// How long a reader waits before the wait itself becomes the answer. Five times the measured
    /// floor, so a slow network never trips it and a hung CLI does.
    static let patience = Duration.seconds(25)

    private let home: URL
    private let searchPath: String

    /// The sign-in this machine has, on the `PATH` the user's shell gives.
    init() {
        self.init(signedInAt: CodexSignInReader.home())
    }

    /// Which sign-in answers. A `CODEX_HOME` rather than an Account, because Codex's identity is
    /// the CLI's own and Argo only reads it — `CodexSignIn` says why.
    init(signedInAt home: URL, searchPath: String = LoginShellPath.resolved()) {
        self.home = home
        self.searchPath = searchPath
    }

    func answer(_ question: String, over tickets: [Ticket]) async -> Result<
        BacklogAnswer, BacklogAskRefusal,
    > {
        do {
            let signIn = try CodexSignInReader.read(in: home)
            guard let executable = AgentExecutable.locate("codex", on: searchPath) else {
                return .failure(.noCLI(detail: "Codex is not installed on this Mac"))
            }
            let prompt = BacklogAskPrompt.text(question: question, tickets: tickets)
            let clock = ContinuousClock()
            let started = clock.now
            let prose = try await run(executable, prompt: prompt)
            let answer = BacklogAnswer(
                prose: prose, answeredBy: signIn, took: clock.now - started,
            )
            return .success(answer)
        } catch let refusal as BacklogAskRefusal {
            return .failure(refusal)
        } catch is CancellationError {
            return .failure(.refused(detail: "The question was stopped"))
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
