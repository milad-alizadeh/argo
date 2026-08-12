import Foundation

/// The Codex threads Argo holds, one per claim — the app-server counterpart of `AgentTerminals`,
/// and keyed the same way, because a claim is what survives the re-key to the id the CLI picks.
///
/// The registry rather than the driver holds them, for the reason the terminals table does: the
/// adapter is a value with no state to be the second copy of, and a Session that could be reached
/// through two tables would have two answers to "is this steerable".
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

    /// One chunk of that server's stdout, on its way to the thread's own reader.
    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) {
        threads[claim]?.received(chunk)
    }

    /// The process is gone, so the thread is: what is left of it is on disk, and nothing here can
    /// reach it.
    func close(_ claim: SessionOwnership.ClaimID) {
        threads.removeValue(forKey: claim)
    }
}
