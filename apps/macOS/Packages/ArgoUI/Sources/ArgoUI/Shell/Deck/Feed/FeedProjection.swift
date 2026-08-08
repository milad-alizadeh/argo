import ArgoEngine

/// The transcript stream, as rows to draw.
///
/// Deliberately the thinnest thing that can be called a projection: it selects the kinds this feed
/// draws and hands their text on untouched. Everything a richer feed will want — grouping calls,
/// folding a turn, pairing a result to its call — is a later ticket's, and each of them is a way
/// this could stop being a reading of the record.
enum FeedProjection {
    /// Rows in the stream's own order. Nothing is sorted, nothing is promoted, and an event kind
    /// with no row yet contributes none rather than a placeholder — a surface that drew "tool call"
    /// in a box would be claiming a shape the ticket that owns it has not decided.
    static func rows(from events: [TranscriptEvent]) -> [FeedRow] {
        events.compactMap(kind(of:)).enumerated().map { position, drawable in
            FeedRow(id: position, kind: drawable.kind, text: drawable.text)
        }
    }

    /// The `switch` carries no `default`, so an event kind added to the domain fails this build
    /// rather than being silently dropped by the surface that should have drawn it.
    private static func kind(of event: TranscriptEvent) -> (kind: FeedRow.Kind, text: String)? {
        switch event {
        case let .prompt(text, _): (.prompt, text)
        case let .message(markdown): (.message, markdown)
        // A separate case from `.message` on purpose, and it stays separate: the two carry the
        // same words often enough that collapsing them would read a turn's reasoning as its answer.
        case let .thought(markdown): (.thought, markdown)
        case .recordIdentity, .headLeaf, .title, .cwd, .model, .branch, .toolCall, .toolCallOutcome,
             .turnEnded, .plan, .compaction, .unreadableLine: nil
        }
    }
}
