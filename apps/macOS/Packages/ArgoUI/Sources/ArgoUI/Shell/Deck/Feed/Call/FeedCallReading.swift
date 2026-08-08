import ArgoEngine

/// An emitted call, plus the outcome that answered it, as the sentence the feed draws.
///
/// The pairing is the reason this is not a `map` over the stream: a call and its result are two
/// events that can sit arbitrarily far apart, and the row is a reading of both. A call the record
/// has not answered yet is still a row — it happened — it just has nothing behind it.
enum FeedCallReading {
    /// `nil` where the call is not the feed's news to tell. The plan tool is the case: what it
    /// wrote is standing state with a surface of its own, and drawing the call as well would say
    /// the same thing twice.
    static func call(_ call: ToolCall, outcome: ToolCallOutcome?) -> FeedCall? {
        let diff = patch(of: outcome)
        guard let kind = kind(of: call, mutating: diff) else { return nil }
        return FeedCall(
            kind: kind,
            subject: subject(of: call),
            churn: diff.map { FeedCall.Churn(added: $0.added, removed: $0.removed) },
            failure: failure(of: outcome),
            disclosure: outcome?.result == nil ? .none : .available,
        )
    }

    private static func patch(of outcome: ToolCallOutcome?) -> DiffEvidence? {
        guard case let .diff(diff) = outcome?.result else { return nil }
        return diff
    }

    private static func kind(of call: ToolCall, mutating diff: DiffEvidence?) -> FeedCall.Kind? {
        switch call.kind {
        case .search: .search
        case .read: .read
        case .edit: mutation(diff, from: call.target)
        case .execute: .execute
        case .fetch: .fetch
        case .delegate: .delegate
        case .mcp: .mcp
        case .plan: nil
        case .other: .unclassified
        }
    }

    /// Which mutation it was, from the patch rather than from the tool's name — `Write` both
    /// creates and updates, and the record is the only thing that knows which. A mutation whose
    /// patch was never read is an edit: the fallback claims the least.
    private static func mutation(_ diff: DiffEvidence?, from source: String?) -> FeedCall.Kind {
        switch diff?.change {
        case .create: .create
        case .delete: .delete
        case .move: .move(destination: moveDestination(diff?.destination, from: source))
        case .modify, nil: .edit
        }
    }

    /// Where a move went, said as shortly as the feed says everything else: the folder it landed
    /// in, or its new name where the move renamed it. A destination path drawn whole would be the
    /// one line in a feed that shows no paths that showed one.
    private static func moveDestination(_ destination: String?, from source: String?) -> String? {
        let parts = destination?.split(separator: "/").map(String.init) ?? []
        guard let name = parts.last else { return nil }
        let renamed = name != source?.split(separator: "/").last.map(String.init)
        return renamed ? name : parts.dropLast().last
    }

    private static func subject(of call: ToolCall) -> FeedCall.Subject {
        if call.kind == .mcp {
            return .plain(mcpAddress(of: call.name))
        }
        // A call that named nothing is named by the tool that made it — the local command the CLI
        // ran is the shape this exists for, and it has a name but no arguments to show.
        guard let named = call.target else { return .plain(call.name) }
        switch call.kind {
        case .read, .edit:
            return FeedCall.FileName(path: named).map(FeedCall.Subject.file) ?? .plain(named)
        case .execute:
            return .command(named)
        case .search, .fetch, .delegate, .mcp, .plan, .other:
            return .plain(named)
        }
    }

    /// `mcp__linear__list_issues` → `linear · list_issues`. The host's own delimiter, drawn as one:
    /// nothing is renamed, and a name that does not follow the convention is shown as it stands.
    private static func mcpAddress(of name: String) -> String {
        let parts = name.dropFirst(mcpToolPrefix.count)
            .components(separatedBy: mcpNameSeparator)
            .filter { !$0.isEmpty }
        return parts.isEmpty ? name : parts.joined(separator: " · ")
    }

    /// What a failed call said about itself, or `nil` for one that did not fail. A failure the
    /// record answered with nothing still reports as a failure with neither line — the mark says
    /// it went wrong, and inventing a reason is the one thing a diagnostic may not do.
    private static func failure(of outcome: ToolCallOutcome?) -> CommandFailure? {
        guard let outcome, outcome.status == .failed else { return nil }
        guard case let .output(output) = outcome.result else {
            return CommandFailure(status: nil, diagnostic: nil)
        }
        return commandFailure(in: output.text)
    }
}
