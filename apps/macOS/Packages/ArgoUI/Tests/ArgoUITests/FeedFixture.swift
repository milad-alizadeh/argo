import ArgoEngine
@testable import ArgoUI

/// Calls as a transcript writes them — an emitted call, and the outcome that answers it some
/// records later. Every fixture here is a pair for that reason: a call written as one finished
/// object would skip the half of the reading that has to find its result at all.
enum FeedFixture {
    static func call(
        _ id: String,
        _ name: String,
        _ kind: ToolCallKind,
        _ target: String?,
    )
        -> ToolCall {
        ToolCall(id: id, name: name, kind: kind, target: target, atMs: nil)
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

    static func patch(
        _ change: FileChange,
        added: Int = 0,
        removed: Int = 0,
        destination: String? = nil,
    )
        -> ToolResult {
        .diff(DiffEvidence(
            tier: .direct,
            change: change,
            destination: destination,
            added: added,
            removed: removed,
            hunks: [],
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
        calls(in: paths.enumerated().flatMap { position, path -> [TranscriptEvent] in
            [.toolCall(call("read-\(position)", "Read", .read, path))]
        })
    }
}
