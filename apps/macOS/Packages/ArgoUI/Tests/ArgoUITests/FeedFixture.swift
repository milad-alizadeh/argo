import ArgoEngine
@testable import ArgoUI

/// Calls as a transcript writes them — an emitted call, and the outcome that answers it some
/// records later. Every fixture here is a pair for that reason: a call written as one finished
/// object would skip the half of the reading that has to find its result at all.
enum FeedFixture {
    static func call(
        _ id: String,
        tool: String,
        kind: ToolCallKind,
        naming target: String? = nil,
    )
        -> ToolCall {
        ToolCall(id: id, name: tool, kind: kind, target: target, atMs: nil)
    }

    static func answered(_ id: String, _ result: ToolResult?) -> ToolCallOutcome {
        ToolCallOutcome(id: id, status: .completed, result: result, endedAtMs: nil, usage: nil)
    }

    static func failed(_ id: String, printing output: String?) -> ToolCallOutcome {
        ToolCallOutcome(
            id: id,
            status: .failed,
            result: output.map { .output(OutputEvidence(tier: .direct, text: $0)) },
            endedAtMs: nil,
            usage: nil,
        )
    }

    /// A patch, with a hunk in it unless the fixture is asking for one nothing could read. The hunk
    /// is what makes it something the panel can show — a change with no readable patch is a row
    /// that does not open, and half these fixtures are about that difference.
    static func patch(
        _ change: FileChange,
        added: Int = 0,
        removed: Int = 0,
        destination: String? = nil,
        hunks: [DiffHunk] = [DiffHunk(
            oldStart: 1,
            newStart: 1,
            lines: [DiffLine(side: .add, text: "let token = 1")],
        )],
    )
        -> ToolResult {
        .diff(DiffEvidence(
            tier: .direct,
            change: change,
            destination: destination,
            added: added,
            removed: removed,
            hunks: hunks,
        ))
    }

    /// Every call row a stream produced, in order — what the assertions are actually about.
    static func calls(in events: [TranscriptEvent]) -> [FeedCall] {
        FeedProjection.rows(from: events).compactMap { row in
            guard case let .call(call) = row.content else { return nil }
            return call
        }
    }

    /// One `Read` of a path, already resolved, as the shortest way to ask what a subject reads as.
    static func read(_ paths: String...) -> [FeedCall] {
        calls(in: paths.enumerated().map { position, path in
            .toolCall(call("read-\(position)", tool: "Read", kind: .read, naming: path))
        })
    }
}
