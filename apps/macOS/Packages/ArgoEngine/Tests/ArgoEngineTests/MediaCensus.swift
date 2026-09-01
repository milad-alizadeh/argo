@testable import ArgoEngine

/// Where a retained event stream's bytes actually ARE, by the kind of event holding them.
///
/// What told the media payload from everything else it sits beside: over six real transcripts the
/// pictures were 69 MB of a 70 MB census — 98% of every character the streams held — which is why
/// #989 addressed those and evicted nothing (`MediaMemoryCostTests`).
///
/// Characters only, and only where an event carries prose: an event with no payload is counted as
/// one, so a stream of nothing but plumbing does not read as empty.
func censusByKind(_ events: [TranscriptEvent]) -> [String: Int] {
    var tally: [String: Int] = [:]
    for event in events {
        for (kind, bytes) in bytes(of: event) {
            tally[kind, default: 0] += bytes
        }
    }
    return tally
}

private func bytes(of event: TranscriptEvent) -> [(String, Int)] {
    switch event {
    case let .prompt(text, images, _):
        [("prompt", text.utf8.count), ("media", images.reduce(0) { $0 + retained($1) })]
    case let .message(markdown):
        [("message", markdown.utf8.count)]
    case let .thought(markdown):
        [("thought", markdown.utf8.count)]
    case let .toolCall(call):
        [(
            "call",
            call.name.utf8.count + (call.target?.utf8.count ?? 0)
                + (call.narration?.utf8.count ?? 0),
        )]
    case let .toolCallOutcome(outcome):
        [bytes(of: outcome.result)]
    case let .unreadableLine(raw):
        [("unreadable", raw.utf8.count)]
    default:
        [("other", 1)]
    }
}

private func bytes(of result: ToolResult?) -> (String, Int) {
    switch result {
    case let .media(media): ("media", retained(media))
    case let .output(output): ("output", output.text.utf8.count)
    case let .diff(diff):
        ("diff", diff.hunks.reduce(0) { $0 + $1.lines.reduce(0) { $0 + $1.text.utf8.count } })
    case nil: ("outcome", 1)
    }
}

private func retained(_ media: MediaEvidence) -> Int {
    media.bytes?.retainedBytes ?? 0
}
