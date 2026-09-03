import ArgoDesign
import ArgoEngine

/// The header's identity facts: the Workspace's marks, what is running, and the linked issue.
extension SessionHeaderProjection {
    /// The branch and the glyph that says which kind of checkout it is on. The kind is carried by
    /// SWAPPING the branch's own mark, not by a second mark after it — so an unread kind draws NO
    /// mark, since the plain branch mark would then read as "not a worktree" (`CONTEXT.md`
    /// degrade-down).
    static func checkout(
        for workspace: CockpitPresentation.Session.Workspace?,
    )
        -> Header.Checkout? {
        guard let branch = workspace?.branch else { return nil }
        // A `switch`, so a third kind of checkout has to answer here rather than inheriting
        // whichever glyph the mapping happens to end on.
        return switch workspace?.kind {
        case .worktree:
            Header.Checkout(
                branch: branch,
                symbol: ArgoSymbol.worktree,
                detail: "On \(branch), in a worktree of its own",
            )
        case .main:
            Header.Checkout(
                branch: branch,
                symbol: ArgoSymbol.branch,
                detail: "On \(branch), in the Project's own checkout",
            )
        case nil:
            Header.Checkout(branch: branch, symbol: nil, detail: "On \(branch)")
        }
    }

    /// The Workspace's counts as drawn marks, in reading order: what is uncommitted in it, then
    /// what is unpushed from it. A zero renders NOTHING, and so does an absent count — what must
    /// never appear is `•0`, a count drawn over an answer Argo does not have.
    static func marks(for workspace: CockpitPresentation.Session.Workspace?) -> [Header.Mark] {
        guard let workspace else { return [] }
        return [
            countMark(
                workspace.dirty,
                symbol: ArgoSymbol.uncommitted,
                thing: "uncommitted file",
            ),
            countMark(
                workspace.unpushed,
                symbol: ArgoSymbol.unpushed,
                thing: "unpushed commit",
            ),
        ].compactMap(\.self)
    }

    /// The CLI, and the CLI ALONE — `Claude Code`.
    ///
    /// It used to read `Claude Code · Opus 5`. The model came off here in #558, when Model and
    /// Effort became things the composer SETS: a value stated in two places is one you keep in sync
    /// by eye, and the composer is where a reader can act on it (design decision 2). What is left
    /// is the one fact about this Session the composer says nothing about.
    static func agent(cli: AgentCLI?) -> String? {
        cli?.readableName
    }

    /// The Issue row for a Session's Ticket reading (#894). A bound provider and no link reads as
    /// unlinked rather than drawing nothing: the row going missing was indistinguishable from a
    /// header that had not loaded, and it is the one state a reader can repair.
    ///
    /// `unread` draws nothing at all, and no attach affordance with it: with no Ticket provider
    /// connected there are no Tickets to attach (`CONTEXT.md` L1).
    static func row(for ticket: CockpitPresentation.Session.TicketLinkReading) -> Header.IssueRow? {
        switch ticket {
        case .unread: nil
        case .unlinked: .unlinked
        // Named, never bare: `#400` alone is whatever number the reader last saw one of.
        case let .linked(issue): .link(Header.IssueLink(
                number: issue.number,
                label: "Issue #\(issue.number)",
                detail: issue.title,
            ))
        }
    }

    private static func countMark(
        _ count: Int?,
        symbol: String,
        thing: String,
    )
        -> Header.Mark? {
        guard let count, count > 0 else { return nil }
        let plural = count == 1 ? thing : "\(thing)s"
        return Header.Mark(symbol: symbol, count: count, detail: "\(count) \(plural)")
    }
}
