import ArgoEngine

// One event → one terminal line. A debugging surface, not a rendering: it names the tier on every
// fact that has one and clamps prose to a width, so the SHAPE of a session is readable in a scroll
// without any of it claiming to be the cockpit's own reading.

private let proseWidth = 100

/// Prose on one line, so an event is one row. Clamped rather than wrapped, and marked where it was
/// cut: this is the one place in the engine that shortens anything a host wrote, and it exists for
/// a terminal rather than for a consumer.
private func oneLine(_ text: String, width: Int = proseWidth) -> String {
    let flat = text
        .replacingOccurrences(of: "\n", with: "⏎ ")
        .trimmingCharacters(in: .whitespaces)
    return flat.count <= width ? flat : "\(flat.prefix(width))…"
}

private func describe(_ result: ToolResult) -> String {
    switch result {
    case let .diff(diff):
        let churn = "+\(diff.added)/-\(diff.removed)"
        return "[\(diff.tier.rawValue)] \(diff.change.rawValue) \(churn), \(diff.hunks.count) hunk(s)"
    case let .output(output):
        return "[\(output.tier.rawValue)] \(oneLine(output.text, width: 60))"
    case let .media(media):
        // The bytes are never printed. What matters at this grain is that there ARE some, and
        // which tier they came from: embedded is what the agent saw, a disk read is only what is
        // at that path now.
        let bytes = media.bytes.map { "\($0.count) base64 chars" } ?? "no bytes"
        return "[\(media.tier.rawValue)] \(media.mediaType), \(bytes)"
    }
}

/// The pictures a prompt was sent with, counted rather than printed — the bytes are never shown at
/// this grain, the same as a media result's.
private func describe(sentWith images: [MediaEvidence]) -> String {
    images.isEmpty ? "" : "  [\(images.count) image(s)]"
}

func describe(_ event: TranscriptEvent) -> String {
    switch event {
    case let .recordIdentity(uuid): "record      \(uuid)"
    case let .headLeaf(uuid): "head-leaf   \(uuid)"
    case let .originSession(id): "origin      \(id)"
    case let .title(title): "title       \(title)"
    case let .cwd(cwd): "cwd         \(cwd)"
    case let .model(model): "model       \(model)"
    case let .effort(cli): "effort      \(cli)"
    case let .branch(branch): "branch      \(branch)"
    case let .mode(cli): "mode        \(cli)"
    case let .entry(cli): "entry       \(cli)"
    case let .prompt(text, images, _): "prompt      \(oneLine(text))\(describe(sentWith: images))"
    case let .message(markdown): "message     \(oneLine(markdown))"
    case let .thought(markdown): "thought     \(oneLine(markdown))"
    case let .skillLoaded(load): "skill       \(load.name) → \(load.directory)"
    case let .toolCall(call):
        "call        \(call.name) (\(call.kind.rawValue))\(call.target.map { " → \($0)" } ?? "")"
    case let .toolCallOutcome(outcome):
        "  ↳ \(outcome.status.rawValue)  \(outcome.result.map(describe) ?? "")"
    case let .turnEnded(reason): "turn ended  \(reason.rawValue)"
    case .interrupted: "interrupted somebody stopped the Turn"
    case let .plan(plan): describe(plan)
    case let .usage(usage): "usage       \(usage.inputTokens) in, \(usage.outputTokens) out"
    case .queued: "queued      a prompt queued rather than run"
    case let .superseded(record): "superseded  the branch opened by \(record) was put again"
    case .excerpted: "excerpt     a stretch of the file was not read"
    case .compaction: "compaction  history condensed here"
    case let .unreadableLine(raw): "unreadable  \(oneLine(raw, width: 60))"
    }
}

/// How far down the list the agent is. Its own function rather than an arm, so the switch above
/// stays one line of prose per event.
private func describe(_ plan: Plan) -> String {
    let done = plan.entries.count { $0.status == .completed }
    return "plan        \(plan.entries.count) entries, \(done) done"
}
