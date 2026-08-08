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
        )
    }

    /// A result the panel could actually show something for, or `nil`.
    ///
    /// The filter is here rather than in the panel because it decides whether the ROW opens at all:
    /// a `Bash` that printed nothing and a patch nothing could parse used to offer a chevron and
    /// answer it with a line of apology, which is a click the feed asked for and then wasted. The
    /// call still happened, and the line still says so.
    private static func kept(_ result: ToolResult?) -> ToolResult? {
        switch result {
        // Blank output never reaches here — the engine reads whitespace as no output at all.
        case .output: result
        case let .diff(diff): diff.hunks.isEmpty ? nil : result
        case let .media(media): media.bytes == nil ? nil : result
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
        case .edit: mutation(diff, from: call.target)
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
    /// With no patch to read it stays `edit`, which is not a guess: `edit` is the ENGINE's kind
    /// for the tool, read off its name, and it is the least the four verbs can say. What is
    /// unknown is which mutation it was, and none of the other three is claimed without evidence.
    private static func mutation(_ diff: DiffEvidence?, from source: String?) -> FeedCall.Kind {
        switch diff?.change {
        case .create: .create
        case .delete: .delete
        case .move: .move(destination: moveDestination(diff?.destination, from: source))
        case .modify, nil: .edit
        }
    }

    /// Where a move went, said as shortly as the feed says everything else: one component of the
    /// host's destination — the folder it landed in, or its new name where the move renamed it. A
    /// path drawn whole would be the one line in a feed that shows no paths that showed one; the
    /// rest of it is the evidence panel's, which reads the record rather than this.
    private static func moveDestination(_ destination: String?, from source: String?) -> String? {
        let parts = destination?.split(separator: "/").map(String.init) ?? []
        guard let name = parts.last else { return nil }
        let renamed = name != source?.split(separator: "/").last.map(String.init)
        return renamed ? name : parts.dropLast().last
    }

    /// Two kinds are named by their TOOL rather than by anything the call carried: an MCP call,
    /// whose name IS its address, and an unclassified one, where the field a target was scraped
    /// from means nothing without a kind to read it under — drawn, it says `Called whatever it
    /// does` under a verb that already admits Argo does not know what happened.
    private static func subject(of call: ToolCall, within path: FeedPath) -> FeedCall.Subject {
        let named = call.target.map(path.shortened)
        return switch call.kind {
        case .mcp: FeedCall.Subject.plain(mcpAddress(of: call.name))
        case .other: tool(call)
        case .read, .edit: file(at: named) ?? tool(call)
        case .execute: named.map(FeedCall.Subject.command) ?? tool(call)
        case .search, .fetch, .delegate, .plan, .skill:
            named.map(FeedCall.Subject.plain) ?? tool(call)
        }
    }

    /// A call that named nothing is named by the tool that made it — the local command the CLI ran
    /// is the shape this exists for: it has a name, and no arguments to show.
    private static func tool(_ call: ToolCall) -> FeedCall.Subject {
        .plain(call.name)
    }

    private static func file(at path: String?) -> FeedCall.Subject? {
        path.flatMap(FeedCall.FileName.init(path:)).map(FeedCall.Subject.file)
    }

    /// `mcp__linear__list_issues` → `linear · list_issues`. Every word is the host's, in its own
    /// order; what changes is the delimiter it wrote them with, drawn as one. A name that does not
    /// follow the convention is shown exactly as it stands.
    private static func mcpAddress(of name: String) -> String {
        let parts = name.dropFirst(mcpToolPrefix.count)
            .components(separatedBy: mcpNameSeparator)
            .filter { !$0.isEmpty }
        return parts.isEmpty ? name : parts.joined(separator: " · ")
    }

    /// How the call ended, from the host's own status and nothing else. A call the record has not
    /// answered is `pending` — the absence of a result is not a result.
    private static func ending(of outcome: ToolCallOutcome?) -> FeedCall.Ending {
        guard let outcome, outcome.status != .pending, outcome.status != .inProgress else {
            return .pending
        }
        return outcome.status == .failed ? .failed : .succeeded
    }
}
