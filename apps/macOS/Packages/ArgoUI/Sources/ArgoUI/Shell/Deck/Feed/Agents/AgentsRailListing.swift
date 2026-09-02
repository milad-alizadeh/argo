/// What the rail LISTS, out of everything the Session delegated.
///
/// The rail is glanced at to answer one question — who else is working — and the count line has
/// always said so. The LIST under it did not: it held every delegation the reading knew about, so a
/// Session that had fanned out thirty times answered "who is working" with thirty rows of finished
/// work and the two live ones lost inside it (#1090). The finished ones move behind a disclosure:
/// still reachable, because a Subagent that landed is how its spend is read and the rail is the
/// only way into its reading, and no longer occupying the column.
///
/// One value for both forms of the rail: the chips and the collapsed strip's dots list the same
/// Agents.
struct AgentsRailListing {
    /// The chips drawn, in the order the work was handed over. Never re-sorted: a list that put the
    /// live ones first would move a chip under the reader's cursor the moment its Agent reported.
    let listed: [FeedAgent]
    /// The ones held back — what the disclosure counts, and what it opens onto. It is what is
    /// HIDDEN and not simply what has landed, so the count on the control matches what appears when
    /// it is used, revealed or not.
    let finished: [FeedAgent]

    /// `scopedOnto` is the Agent the feed is currently reading, which is listed whatever its state:
    /// hiding it would strand the reader in a Subagent's feed with no chip to come back from, the
    /// same trap `FeedAgentReader.rows(under:of:otherwise:)` is written against.
    init(of agents: [FeedAgent], scopedOnto: Int?, revealing: Bool = false) {
        let held = agents.filter { !$0.isRunning && $0.id != scopedOnto }
        let heldIDs = Set(held.map(\.id))
        self.finished = held
        self.listed = revealing ? agents : agents.filter { !heldIDs.contains($0.id) }
    }
}
