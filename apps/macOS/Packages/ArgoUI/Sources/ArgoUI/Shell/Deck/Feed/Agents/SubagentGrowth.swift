/// When Argo last watched each Subagent's own file grow, by Subagent id — the FOURTH fact, as a
/// value a surface can carry into a walk (#1572).
///
/// The whole table rather than `SubagentEvidence`'s per-id closure: the ids come out of the walk
/// the answer is wanted inside, so there is no moment before it at which one row could ask.
package struct SubagentGrowth: Equatable, Sendable {
    /// Nothing watched: the three-fact reading exactly as it was, and what every fixture, specimen
    /// and suite gets unless it says otherwise.
    package static let unwatched = SubagentGrowth()

    private let lastGrewAtMs: [String: Int]

    package init(lastGrewAtMs: [String: Int] = [:]) {
        self.lastGrewAtMs = lastGrewAtMs
    }

    /// These delegations, told by the growth evidence — the same `FeedAgents.told(_:by:ended:at:)`
    /// the rail is told by, so a row and a chip cannot read one file two ways.
    ///
    /// Unconditional, `unwatched` included: `told` also applies `DelegationCeiling`, so skipping it
    /// on an empty table would move one row's mark with whether an unrelated Session is writing.
    func told(_ agents: [FeedAgent], at nowMs: Int) -> [FeedAgent] {
        FeedAgents.told(
            agents,
            by: SubagentEvidence(
                writing: { SubagentWriting.read(lastGrewAtMs: lastGrewAtMs[$0], nowMs: nowMs) },
                // The roster reads neither. `.open` is the ending that says nothing, and
                // `.unmeasured` the figures nobody here draws.
                ending: { _ in .open },
                measure: { _ in .unmeasured },
            ),
            at: nowMs,
        )
    }
}
