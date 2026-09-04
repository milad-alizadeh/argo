import Foundation

/// What Argo just started: the claim it holds, which program it is, where it runs, and when — the
/// whole of what a spawned Session is known to be before its CLI has written a record. Everything
/// the record has not said yet stays absent rather than defaulted.
struct AgentSpawn: Sendable, Equatable {
    /// How the wait for the child's first byte has gone, in one value — the three moments that can
    /// end it, and nothing else about the spawn.
    ///
    /// Grouped rather than flat because they are read together and only together: `HubSession`
    /// folds all three into one reading (`SessionStartup`), and the Hub's own limit answers the
    /// same question they do (#1245).
    struct Startup: Sendable, Equatable {
        /// When the child first wrote to the PTY, absent until it has, and DIRECT — Argo owns the
        /// descriptor those bytes came out of (#587).
        var firstOutputAtMs: Int?

        /// When Argo stopped waiting for that byte, having found the process still up (#1245).
        /// Absent while the wait is inside its limit, and absent again the moment bytes do arrive:
        /// a child that speaks late is starting late rather than quiet.
        ///
        /// Only the QUIET half of the limit is recorded here. The other half — a child gone with no
        /// exit reported — is written as the exit it is, so one row shape covers every process that
        /// ended (`Hub.processEnded`).
        var quietAtMs: Int?

        /// How the PTY went away, once it has — and only for a spawn whose CLI never wrote a
        /// record, the one row no observation can reach.
        var exit: Exit?
    }

    struct Exit: Sendable, Equatable {
        /// `nil` where the PTY ended without the child reporting a code. Absent is not zero.
        let code: Int32?
        let atMs: Int
    }

    let claim: SessionOwnership.ClaimID
    let cli: AgentCLI
    let cwd: String
    let spawnedAtMs: Int
    /// The Ticket this spawn was started on (#872), and `nil` for a New Session started on
    /// none. On the row as well as under the claim, so the provisional row is claimed from the
    /// moment it appears rather than from the moment its CLI writes a record.
    var ticket: Int?

    /// How far this spawn has got in coming up — see `Startup`.
    var startup = Startup()

    /// The title the roster carries for this row. A spawn that dies at startup says WHICH way it
    /// went, rather than appearing and archiving itself without a word.
    var title: String {
        guard let exit = startup.exit else { return "New session" }
        guard let code = exit.code, code != 0 else { return "\(cli.command) exited" }
        return "\(cli.command) exited (code \(code))"
    }
}

extension AgentSpawn {
    /// The row for a plan that has just started. In an extension so the memberwise init survives
    /// for the fixtures that state a spawn with no plan behind it.
    init(spawning plan: AgentSpawnPlan, atMs: Int) {
        self.init(
            claim: plan.claim,
            cli: plan.cli,
            cwd: plan.cwd,
            spawnedAtMs: atMs,
            ticket: plan.seed.ticket,
        )
    }
}
