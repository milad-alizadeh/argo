import Foundation

/// The process host for `codex app-server`: plain pipes, no PTY.
///
/// Unlike the `claude` adapter, nothing here is pretending to be a terminal. app-server speaks
/// newline-delimited JSON-RPC over stdio, and a PTY between the two would echo every line Argo
/// wrote straight back into the stream it parses and translate the newlines that frame it.
///
/// It lives in `ArgoEngine` rather than beside the SwiftTerm host because it links nothing: a
/// Codex Session can therefore be spawned in a test process with no window.
@MainActor
final class CodexProcessHost: AgentProcessHost {
    func start(_ launch: AgentLaunch, events: AgentProcessEvents) throws -> AgentProcess {
        let process = try CodexServerProcess(events: events)
        try process.start(launch)
        return process
    }
}

/// One running app-server, and the two pipes that are the whole of talking to it.
@MainActor
final class CodexServerProcess: AgentProcess {
    private let events: AgentProcessEvents
    private let process = Process()
    /// `OwnedPipe` and never `Foundation.Pipe`, for the stray close that one leaves behind on a
    /// descriptor number the kernel has since given to something else (#936).
    private let input: OwnedPipe
    private let output: OwnedPipe
    /// So an exit is reported once: a termination handler and Argo's own `terminate` can both
    /// arrive, and the owner retires the row on the first.
    private var hasExited = false

    init(events: AgentProcessEvents) throws {
        self.events = events
        self.input = try OwnedPipe()
        self.output = try OwnedPipe()
    }

    func start(_ launch: AgentLaunch) throws {
        process.executableURL = URL(fileURLWithPath: launch.executablePath)
        process.arguments = launch.arguments
        process.currentDirectoryURL = URL(fileURLWithPath: launch.cwd)
        process.environment = launch.environment
        process.standardInput = input.reading
        process.standardOutput = output.writing
        // The server's own diagnostics are not JSON-RPC, so they are not fed to the parser. They go
        // to Argo's stderr rather than to a pipe nobody drains, which would stall the child.
        process.standardError = FileHandle.standardError
        drainOutput()
        atExit()
        do {
            try process.run()
        } catch {
            throw AgentSpawnError.hostRefused(detail: "\(launch.executablePath) would not start")
        }
        // The child holds its own copies; the parent's copies of the ends it gave away go now, or
        // the server's exit would never reach the reader as EOF.
        input.release(input.reading)
        output.release(output.writing)
    }

    /// One JSON-RPC line.
    ///
    /// A write that fails means the pipe is broken, which means the server is gone — so it is
    /// REPORTED as the exit it is rather than discarded. Swallowing it would leave the claim alive
    /// over a dead process, and every Turn after it would read as sent.
    func write(_ text: String) {
        guard process.isRunning, let data = text.data(using: .utf8) else { return }
        do {
            try input.writing.write(contentsOf: data)
        } catch {
            // No code: the child was never reaped here, and absent is the honest answer for an
            // exit Argo inferred from a broken descriptor rather than watched happen.
            reportExit(nil)
        }
    }

    /// Nothing to size: there is no terminal here for a viewport to match.
    func resize(columns _: Int, rows _: Int) {}

    func terminate() {
        guard process.isRunning else { return }
        process.terminate()
    }

    private func drainOutput() {
        output.reading.readabilityHandler = { [weak self] handle in
            let chunk = [UInt8](handle.availableData)
            guard !chunk.isEmpty else { return }
            Task { @MainActor [weak self] in self?.events.onData(chunk) }
        }
    }

    private func atExit() {
        process.terminationHandler = { [weak self] process in
            let code = process.terminationStatus
            Task { @MainActor [weak self] in self?.reportExit(code) }
        }
    }

    private func reportExit(_ code: Int32?) {
        guard !hasExited else { return }
        hasExited = true
        output.reading.readabilityHandler = nil
        events.onExit(code)
    }
}
