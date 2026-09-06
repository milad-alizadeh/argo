import Foundation

/// The child process, the patience it is held to, and the Stop.
///
/// A `Process` blocks a thread to wait on, so the wait is a continuation resumed from the
/// termination handler rather than a `waitUntilExit` on the caller's. Three things race for it —
/// the exit, the timeout, and the caller's own cancellation — and an actor is what makes that safe
/// to write: all three call `finish`, the actor serialises them, and the first takes the
/// continuation away from the rest. A continuation resumed twice is a crash, and a process CAN exit
/// while the timeout terminates it.
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

    /// The exit code, or the refusal. The prompt and the log are file handles rather than pipes, so
    /// nothing here can stall on a buffer nobody drains.
    ///
    /// **Cancelling stops the child, not just the wait.** The design's Stop is the reason the port
    /// exists in this shape — a reader who presses it and leaves a model running for the rest of
    /// the patience has stopped nothing (`cockpit-backlog-question.md`, **The wait**).
    func wait(_ patience: Duration) async throws -> Int32 {
        try open()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                start(continuation, patience: patience)
            }
        } onCancel: {
            Task { await self.stop() }
        }
    }

    /// The files the child reads and writes. Held on the process, which keeps them open for it.
    private func open() throws {
        FileManager.default.createFile(atPath: run.log.path, contents: nil)
        guard let input = try? FileHandle(forReadingFrom: run.prompt),
              let output = try? FileHandle(forWritingTo: run.log)
        else { throw BacklogAskRefusal.refused(detail: "Argo could not open the question's files") }
        process.standardInput = input
        process.standardOutput = output
        process.standardError = output
    }

    private func start(_ continuation: CheckedContinuation<Int32, Error>, patience: Duration) {
        self.continuation = continuation
        process.terminationHandler = { process in
            let code = process.terminationStatus
            Task { await self.finish(.success(code)) }
        }
        guard (try? process.run()) != nil else {
            finish(.failure(.noCLI(detail: "Codex is installed but would not start")))
            return
        }
        // Already cancelled before the handler was installed, which `withTaskCancellationHandler`
        // does not replay: without this the child outlives a Stop pressed in that window.
        guard !Task.isCancelled else { return stop() }
        expiry = Task { await self.expire(after: patience) }
    }

    /// The losing side of the race. Terminating first means the exit that follows finds the
    /// continuation already taken, which is what keeps the timeout's answer the one the caller
    /// sees.
    private func expire(after patience: Duration) async {
        try? await Task.sleep(for: patience)
        guard !Task.isCancelled, continuation != nil, process.isRunning else { return }
        terminate()
        finish(.failure(.timedOut(after: patience)))
    }

    private func stop() {
        guard continuation != nil else { return }
        terminate()
        finish(.failure(.refused(detail: "The question was stopped")))
    }

    /// Terminate and REAP. The caller deletes the scratch directory the moment it has an answer,
    /// and a child still writing its log into a directory being removed is a race that shows up as
    /// a truncated refusal sentence.
    private func terminate() {
        guard process.isRunning else { return }
        process.terminate()
        process.waitUntilExit()
    }

    private func finish(_ outcome: Result<Int32, BacklogAskRefusal>) {
        guard let continuation else { return }
        self.continuation = nil
        expiry?.cancel()
        continuation.resume(with: outcome.mapError { $0 as Error })
    }
}
