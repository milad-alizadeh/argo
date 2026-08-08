import ArgoEngine

/// The transcript stream, as rows to draw.
///
/// Still deliberately thin: it selects the kinds this feed draws, pairs each call with the outcome
/// that answered it, and hands every character on untouched. Everything a richer feed will want —
/// folding a turn, grouping a run of edits — is a later ticket's, and each of them is a way this
/// could stop being a reading of the record.
enum FeedProjection {
    /// Rows in the stream's own order. Nothing is sorted, nothing is promoted, and an event kind
    /// with no row yet contributes none rather than a placeholder — a surface that drew "tool call"
    /// in a box would be claiming a shape the ticket that owns it has not decided.
    static func rows(from events: [TranscriptEvent]) -> [FeedRow] {
        let answered = outcomes(in: events)
        let read = events.compactMap { content(of: $0, answeredBy: answered) }
        return toldApart(read).enumerated().map { position, content in
            FeedRow(id: position, content: content)
        }
    }

    /// A call's result is read through its id rather than by position: the two events are written
    /// by two different records, and a run of parallel calls interleaves them.
    private static func outcomes(in events: [TranscriptEvent]) -> [String: ToolCallOutcome] {
        events.reduce(into: [:]) { found, event in
            guard case let .toolCallOutcome(outcome) = event else { return }
            found[outcome.id] = outcome
        }
    }

    /// The `switch` carries no `default`, so an event kind added to the domain fails this build
    /// rather than being silently dropped by the surface that should have drawn it.
    private static func content(
        of event: TranscriptEvent,
        answeredBy outcomes: [String: ToolCallOutcome],
    )
        -> FeedRow.Content? {
        switch event {
        case let .prompt(text, _): .prompt(text)
        case let .message(markdown): .message(markdown)
        // A separate case from `.message` on purpose, and it stays separate: the two carry the
        // same words often enough that collapsing them would read a turn's reasoning as its answer.
        case let .thought(markdown): .thought(markdown)
        case let .toolCall(call):
            FeedCallReading.call(call, outcome: outcomes[call.id]).map(FeedRow.Content.call)
        // An outcome is not news of its own — it is what the call it answers produced, and that
        // call's row already carries it.
        case .toolCallOutcome, .recordIdentity, .headLeaf, .title, .cwd, .model, .branch,
             .turnEnded, .plan, .compaction, .unreadableLine: nil
        }
    }

    /// Two files of the same name take the shortest parent that tells them apart — the roster's
    /// rule for two workspaces, shared (#419). Computed over the WHOLE feed rather than per row,
    /// because whether a name is ambiguous is a fact about the feed it sits in, not about the file.
    private static func toldApart(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        let labels = DistinguishingLabel.labels(for: contents.map(path(in:)))
        return zip(contents, labels).map { content, label in qualified(content, as: label) }
    }

    private static func path(in content: FeedRow.Content) -> String? {
        guard case let .call(call) = content,
              case let .file(file) = call.subject else { return nil }
        return file.path
    }

    private static func qualified(_ content: FeedRow.Content, as label: String?) -> FeedRow
        .Content {
        guard case let .call(call) = content, case let .file(file) = call.subject, let label
        else { return content }
        return .call(call.naming(file.qualified(as: label)))
    }
}

extension FeedProjection {
    /// The preview transcript, already projected — the one place every specimen and `#Preview`
    /// takes its rows from, so none of them can be looking at a different feed.
    static let previewRows = rows(from: CockpitPresentation.Session.previewTranscript)

    /// The same feed with the prose taken out. A render of the call vocabulary that is four fifths
    /// paragraphs is a render of the paragraphs — this is a filter over the shipping rows, never a
    /// second set of them.
    static let previewCallRows = previewRows.filter(\.isCall)
}
