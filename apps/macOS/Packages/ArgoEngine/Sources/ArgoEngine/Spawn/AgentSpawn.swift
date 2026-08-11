import Foundation

/// What Argo just started: the claim it holds, which program it is, where it runs, and when — the
/// whole of what a spawned Session is known to be before its CLI has written a record. Everything
/// the record has not said yet stays absent rather than defaulted.
struct AgentSpawn: Sendable, Equatable {
    let claim: SessionOwnership.ClaimID
    let cli: AgentCLI
    let cwd: String
    let spawnedAtMs: Int

    /// How the PTY went away, once it has — and only for a spawn whose CLI never wrote a record,
    /// the one row no observation can reach.
    var exit: Exit?

    struct Exit: Sendable, Equatable {
        /// `nil` where the PTY ended without the child reporting a code. Absent is not zero.
        let code: Int32?
        let atMs: Int
    }

    init(
        claim: SessionOwnership.ClaimID,
        cli: AgentCLI,
        cwd: String,
        spawnedAtMs: Int,
    ) {
        self.claim = claim
        self.cli = cli
        self.cwd = cwd
        self.spawnedAtMs = spawnedAtMs
    }

    /// The title the roster carries for this row. A spawn that dies at startup says WHICH way it
    /// went, rather than appearing and archiving itself without a word.
    var title: String {
        guard let exit else { return "New session" }
        guard let code = exit.code, code != 0 else { return "\(cli.command) exited" }
        return "\(cli.command) exited (code \(code))"
    }
}
