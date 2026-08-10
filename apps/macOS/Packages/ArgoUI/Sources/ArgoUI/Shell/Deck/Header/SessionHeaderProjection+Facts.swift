import ArgoEngine

/// The header's identity facts: the Workspace's marks, what is running, and the linked issue.
///
/// Beside `header(from:)` rather than inside it, because each of these is a rule with its own
/// reasons — an unread count is not a zero, an unknown model is still a model, and a link to a
/// provider nobody connected is worse than no link at all.
extension SessionHeaderProjection {
    /// The Workspace's facts as drawn marks, in reading order: what kind of checkout this is,
    /// then what is uncommitted in it, then what is unpushed from it.
    ///
    /// A zero renders NOTHING. An absent count renders nothing either, and the two are the same
    /// ink on purpose: a mark claims there is something to see, and neither a clean tree nor an
    /// unread one has anything. What must never happen is `•0` — a count drawn over an answer
    /// Argo does not have.
    static func marks(for workspace: CockpitPresentation.Session.Workspace?) -> [Header.Mark] {
        guard let workspace else { return [] }
        return [
            worktreeMark(workspace.kind),
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

    /// The CLI and a readable model name — `Claude Code · Opus 5`.
    ///
    /// Composed of what is present rather than of placeholders: a Session whose record names a
    /// model but no CLI reads as the model alone, which is true, where `Unknown · Opus 5` would
    /// be Argo inventing half a fact to keep a separator company.
    static func agent(cli: AgentCLI?, model: String?) -> String? {
        let parts = [cli.map(name(of:)), model.map(readable(model:))].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The issue as a link, and `nil` whenever there is no link to make.
    ///
    /// There is no attach affordance anywhere near this, deliberately: with no Work Item provider
    /// connected there are no Work Items (`CONTEXT.md` L1), and an "attach a ticket" control over
    /// nothing would offer to assert a link to a provider that does not exist.
    static func link(to issue: CockpitPresentation.Session.Issue?) -> Header.IssueLink? {
        guard let issue else { return nil }
        // Named, never bare: `#400` alone is whatever number the reader last saw one of.
        return Header.IssueLink(label: "Issue #\(issue.number)", detail: issue.title)
    }

    private static func worktreeMark(
        _ kind: CockpitPresentation.Session.WorkspaceKind?,
    )
        -> Header.Mark? {
        // A `switch`, so a third kind of checkout has to answer here rather than inheriting
        // silence. `main` draws nothing: it is where a Session is unless something says otherwise.
        switch kind {
        case .worktree:
            Header.Mark(
                symbol: ArgoSymbol.worktree,
                count: nil,
                detail: "In a worktree of its own",
            )
        case .main, nil:
            nil
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

    private static func name(of cli: AgentCLI) -> String {
        switch cli {
        case .claude: "Claude Code"
        }
    }

    /// An id the table knows, said the way a person says it; an id it does not, VERBATIM.
    ///
    /// Ugly-but-true beats invisible and beats the nearest guess: a model released this morning
    /// renders as its own id rather than as the closest name Argo happens to hold, or as nothing
    /// at all. The date suffix a provider pins a snapshot with is dropped before the lookup, so a
    /// dated id of a model the table DOES know still reads as that model.
    private static func readable(model id: String) -> String {
        ReadableModelName.table[id]
            ?? ReadableModelName.table[ReadableModelName.undated(id)]
            ?? id
    }
}
