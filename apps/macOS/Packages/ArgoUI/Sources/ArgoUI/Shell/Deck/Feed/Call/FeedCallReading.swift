import ArgoEngine

/// An emitted call, plus the outcome that answered it, as the sentence the feed draws.
///
/// Not a `map` over the stream: a call and its result are two events that can sit arbitrarily far
/// apart, and a call the record has not answered yet is still a row with nothing behind it.
enum FeedCallReading {
    /// `nil` where the call is not the feed's news to tell — the plan tool, whose writes are
    /// standing state with a surface of their own.
    static func call(
        _ call: ToolCall,
        outcome: ToolCallOutcome?,
        within path: FeedPath,
    )
        -> FeedCall? {
        let diff = patch(of: outcome)
        guard let kind = kind(of: call, mutating: diff) else { return nil }
        return FeedCall(
            kind: kind,
            subject: subject(of: call, within: path),
            churn: diff.map { FeedCall.Churn(added: $0.added, removed: $0.removed) },
            ending: ending(of: outcome),
            evidence: [kept(outcome?.result)].compactMap(\.self),
            repeats: 1,
            spend: outcome?.usage,
            subagentID: outcome?.subagentID,
        )
    }

    /// A result a surface could actually show something for, or `nil`.
    ///
    /// Here rather than in the panel because it decides whether the ROW opens at all.
    private static func kept(_ result: ToolResult?) -> ToolResult? {
        switch result {
        // Blank output never reaches here — the engine reads whitespace as no output at all.
        case .output: result
        case let .diff(diff): diff.hunks.isEmpty ? nil : result
        // Kept even with no bytes: an absent picture is drawn as one IN the gallery.
        case .media: result
        case nil: nil
        }
    }

    private static func patch(of outcome: ToolCallOutcome?) -> DiffEvidence? {
        guard case let .diff(diff) = outcome?.result else { return nil }
        return diff
    }

    private static func kind(of call: ToolCall, mutating diff: DiffEvidence?) -> FeedCall.Kind? {
        switch call.kind {
        case .search: .search
        case .read: .read
        case .edit: mutation(diff)
        case .execute: .execute
        case .skill: .skill
        case .fetch: .fetch
        case .delegate: .delegate
        case .mcp: .mcp
        case .plan: nil
        case .other: .unclassified
        }
    }

    /// Which mutation it was, from the patch rather than from the tool's name — `Write` both
    /// creates and updates, and only the record knows which.
    ///
    /// With no patch it stays `edit`, the engine's kind read off the tool's name: none of the
    /// other three verbs is claimed without evidence.
    private static func mutation(_ diff: DiffEvidence?) -> FeedCall.Kind {
        switch diff?.change {
        case .create: .create
        case .delete: .delete
        case .move: .move
        case .modify, nil: .edit
        }
    }

    /// The agent's own account of the call outranks whatever it named, wherever the row is not
    /// already addressed by a name of its own. Three are: a file, a skill, and an MCP tool whose
    /// name IS its address — those keep the subject that already identifies them.
    private static func subject(of call: ToolCall, within path: FeedPath) -> FeedCall.Subject {
        let named = call.target.map(path.shortened)
        let narrated = call.narration.map { FeedCall.Subject.narration($0, standingIn: named) }
        return switch call.kind {
        case .mcp: FeedCall.Subject.plain(mcpAddress(of: call.name))
        case .other: narrated ?? tool(call)
        case .read, .edit: file(at: named, within: path) ?? tool(call)
        case .skill: named.map(FeedCall.Subject.plain) ?? tool(call)
        case .execute: narrated ?? named.map(FeedCall.Subject.command) ?? tool(call)
        case .search, .fetch, .delegate, .plan:
            narrated ?? named.map(FeedCall.Subject.plain) ?? tool(call)
        }
    }

    /// A call that named nothing is named by the tool that made it.
    private static func tool(_ call: ToolCall) -> FeedCall.Subject {
        .plain(call.name)
    }

    /// The address is already relative to the Session's cwd by the time it reaches here, so whether
    /// it is external is a question about what the shortening LEFT.
    private static func file(at named: String?, within path: FeedPath) -> FeedCall.Subject? {
        named
            .flatMap { FeedCall.FileName(path: $0, isExternal: path.isExternal($0)) }
            .map(FeedCall.Subject.file)
    }

    /// `mcp__linear__list_issues` → `linear · list_issues`. A name that does not follow the
    /// convention is shown exactly as it stands.
    private static func mcpAddress(of name: String) -> String {
        let parts = name.dropFirst(mcpToolPrefix.count)
            .components(separatedBy: mcpNameSeparator)
            .filter { !$0.isEmpty }
        return parts.isEmpty ? name : parts.joined(separator: " · ")
    }

    /// How the call ended, from the host's own status and nothing else. A call the record has not
    /// answered is `pending`.
    private static func ending(of outcome: ToolCallOutcome?) -> FeedCall.Ending {
        guard let outcome, outcome.status != .pending, outcome.status != .inProgress else {
            return .pending
        }
        return outcome.status == .failed ? .failed : .succeeded
    }
}
