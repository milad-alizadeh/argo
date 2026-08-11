import Foundation

/// What Argo just started: the claim it holds, which program it is, where it runs, and when — the
/// whole of what a spawned Session is known to be before its CLI has written a record. Everything
/// the record has not said yet stays absent rather than defaulted.
struct AgentSpawn: Sendable, Equatable {
    let claim: SessionOwnership.ClaimID
    let cli: AgentCLI
    let cwd: String
    let spawnedAtMs: Int
    /// The rung Argo started it on (ADR-0025) — DIRECT, and the only place `Plan` can be known
    /// from: the CLI reports Read Only's boundary for Plan too, so nothing observed carries the
    /// intent.
    let mode: SessionMode

    /// How the PTY went away, once it has — and only for a spawn whose CLI never wrote a record,
    /// the one row no observation can reach.
    var exit: Exit?

    struct Exit: Sendable, Equatable {
        /// `nil` where the PTY ended without the child reporting a code. Absent is not zero.
        let code: Int32?
        let atMs: Int
    }

    /// The title the roster carries for this row. A spawn that dies at startup says WHICH way it
    /// went, rather than appearing and archiving itself without a word.
    var title: String {
        guard let exit else { return "New session" }
        guard let code = exit.code, code != 0 else { return "\(cli.command) exited" }
        return "\(cli.command) exited (code \(code))"
    }
}
