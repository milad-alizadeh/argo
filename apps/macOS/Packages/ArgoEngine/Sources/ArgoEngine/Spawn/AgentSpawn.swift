import Foundation

/// What Argo just started: the claim it holds, which program it is, where it runs, and when.
///
/// This is the whole of what a spawned Session is known to be before its CLI has written a record.
/// Everything the record has not said yet stays absent rather than defaulted: no model, no branch,
/// no runtime tree.
public struct AgentSpawn: Sendable, Equatable {
    public let claim: SessionOwnership.ClaimID
    public let cli: AgentCLI
    public let cwd: String
    public let spawnedAtMs: Int

    /// How the PTY went away, once it has — and only for a spawn whose CLI never wrote a record.
    /// That row is the one no observation can reach, so the same act that published it says when it
    /// ended, and which way.
    public var exit: Exit?

    public struct Exit: Sendable, Equatable {
        /// `nil` where the PTY ended without the child reporting a code. Absent is not zero.
        public let code: Int32?
        public let atMs: Int

        public init(code: Int32?, atMs: Int) {
            self.code = code
            self.atMs = atMs
        }
    }

    public init(
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

    /// The title the roster carries for this row.
    ///
    /// A spawn that dies at startup would otherwise appear and archive itself without a word — the
    /// same silence the provisional row set out to end — so the row says WHICH way it went.
    var title: String {
        guard let exit else { return "New session" }
        guard let code = exit.code, code != 0 else { return "\(cli.command) exited" }
        return "\(cli.command) exited (code \(code))"
    }
}
