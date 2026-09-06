import Foundation

/// The child process, and the patience it is held to.
///
/// A `Process` blocks a thread to wait on, so the wait is a continuation resumed from the
/// termination handler rather than a `waitUntilExit` on the caller's. The timeout is a second task
/// racing it, and an actor is what makes that race safe to write: both sides call `finish`, the
/// actor serialises them, and the first one to arrive takes the continuation away from the other. A
/// continuation resumed twice is a crash, and a process CAN exit while the timeout terminates it.
actor CodexExecProcess {
    private let process = Process()
    private let run: CodexExecRun
    private var continuation: CheckedContinuation<Int32, Error>?
    private var expiry: Task<Void, Never>?

    init(run: CodexExecRun, executable: String, searchPath: String) {
        self.run = run
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = run.arguments
        process.currentDirectoryURL = run.directory
        process.environment = CodexExecRun.environment(path: searchPath)
    }

    /// The exit code, or the timeout refusal. The prompt and the log are file handles rather than
    /// pipes, so nothing here can stall on a buffer nobody drains.
    func wait(_ patience: Duration) async throws -> Int32 {
        FileManager.default.createFile(atPath: run.log.path, contents: nil)
        guard let input = try? FileHandle(forReadingFrom: run.prompt),
              let output = try? FileHandle(forWritingTo: run.log)
        else { throw BacklogAskRefusal.refused(detail: "Argo could not open the question's files") }
        process.standardInput = input
        process.standardOutput = output
        process.standardError = output
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            process.terminationHandler = { process in
                let code = process.terminationStatus
                Task { await self.finish(.success(code)) }
            }
            guard (try? process.run()) != nil else {
                let detail = "Codex is installed but would not start"
                finish(.failure(.noCLI(detail: detail)))
                return
            }
            expiry = Task { await self.expire(after: patience) }
        }
    }

    /// The losing side of the race. Terminating first means the exit that follows finds the
    /// continuation already taken, which is what keeps the timeout's answer the one the caller
    /// sees.
    private func expire(after patience: Duration) async {
        try? await Task.sleep(for: patience)
        guard !Task.isCancelled, continuation != nil, process.isRunning else { return }
        process.terminate()
        finish(.failure(.timedOut(after: patience)))
    }

    private func finish(_ outcome: Result<Int32, BacklogAskRefusal>) {
        guard let continuation else { return }
        self.continuation = nil
        expiry?.cancel()
        continuation.resume(with: outcome.mapError { $0 as Error })
    }
}
