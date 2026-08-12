import Foundation

/// The Codex threads Argo holds, one per claim — the app-server counterpart of `AgentTerminals`,
/// and keyed the same way, because a claim is what survives the re-key to the id the CLI picks.
///
/// Holding a thread here is also what says a Session is a Codex one, which is how the port picks
/// its adapter (`SessionAdapters`).
@MainActor
final class CodexThreads {
    private var threads: [SessionOwnership.ClaimID: CodexThread] = [:]

    /// Take a freshly spawned app-server and say hello to it.
    func open(_ claim: SessionOwnership.ClaimID, thread: CodexThread) {
        threads[claim] = thread
        thread.begin()
    }

    func thread(for claim: SessionOwnership.ClaimID) -> CodexThread? {
        threads[claim]
    }

    /// One chunk of that server's stdout, on its way to the thread's own reader. `false` where this
    /// claim is not a Codex one at all, which is what tells the caller the chunk is a PTY's.
    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) -> Bool {
        guard let thread = threads[claim] else { return false }
        thread.received(chunk)
        return true
    }

    /// The process is gone, so the thread is: what is left of it is on disk, and nothing here can
    /// reach it.
    func close(_ claim: SessionOwnership.ClaimID) {
        threads.removeValue(forKey: claim)
    }
}
