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

    /// The CLI and a readable model name — `Claude Code · Opus 5`. Composed of what is present,
    /// never of placeholders: a record naming a model but no CLI reads as the model alone.
    static func agent(cli: AgentCLI?, model: String?) -> String? {
        let parts = [cli?.readableName, model.map(ReadableModelName.readable)].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The issue as a link, and `nil` whenever there is no link to make. No attach affordance:
    /// with no Work Item provider connected there are no Work Items (`CONTEXT.md` L1).
    static func link(to issue: CockpitPresentation.Session.Issue?) -> Header.IssueLink? {
        guard let issue else { return nil }
        // Named, never bare: `#400` alone is whatever number the reader last saw one of.
        return Header.IssueLink(label: "Issue #\(issue.number)", detail: issue.title)
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
