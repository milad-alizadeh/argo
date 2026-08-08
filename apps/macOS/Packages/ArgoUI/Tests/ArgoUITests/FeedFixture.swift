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

    /// A picture as a record answers a call with one. `bytes: nil` is the call the record answered
    /// without any — the honest absence, and the only shot that opens nothing.
    ///
    /// The bytes are a real one-pixel PNG rather than an arbitrary string, because half of what
    /// the gallery does with a shot depends on the image decoding at all.
    static func shot(_ tier: Tier, bytes: String? = onePixelPNG) -> ToolResult {
        .media(MediaEvidence(tier: tier, mediaType: "image/png", bytes: bytes))
    }

    /// The smallest thing that is genuinely a PNG: one opaque pixel.
    static let onePixelPNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z"
        + "8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="

    /// Every gallery a stream produced, in order.
    static func galleries(in rows: [FeedRow]) -> [FeedGallery] {
        rows.compactMap { row in
            guard case let .gallery(gallery) = row.content else { return nil }
            return gallery
        }
    }

    /// A `Read` of one path answered with a picture — the pair that makes a gallery.
    static func looked(at path: String, _ result: ToolResult) -> [TranscriptEvent] {
        [
            .toolCall(call("shot-\(path)", tool: "Read", kind: .read, naming: path)),
            .toolCallOutcome(answered("shot-\(path)", result)),
        ]
    }

    /// Every call a stream produced, in order — what the assertions are actually about.
    ///
    /// Reaches INSIDE a folded run of looking. What a call says it did is a claim about the call;
    /// whether it got a line of its own is a claim about the fold, and `surveys(in:)` is where that
    /// one is made. A helper that stopped at the row would have let the fold quietly empty half the
    /// vocabulary suite instead of failing it.
    static func calls(in events: [TranscriptEvent]) -> [FeedCall] {
        FeedProjection.rows(from: events).flatMap { row -> [FeedCall] in
            switch row.content {
            case let .call(call): [call]
            case let .survey(survey): survey.calls
            // A gallery keeps its pictures and drops the sentence that carried them: a run of six
            // shots has no line left to make a claim about. `galleries(in:)` is where that half is
            // asserted.
            case .prompt, .message, .thought, .gallery: []
            }
        }
    }

    /// Every folded run of looking a stream produced, in order.
    static func surveys(in rows: [FeedRow]) -> [FeedSurvey] {
        rows.compactMap { row in
            guard case let .survey(survey) = row.content else { return nil }
            return survey
        }
    }

    /// One `Read` of a path, already resolved, as the shortest way to ask what a subject reads as.
    static func read(_ paths: String...) -> [FeedCall] {
        calls(in: paths.enumerated().map { position, path in
            .toolCall(call("read-\(position)", tool: "Read", kind: .read, naming: path))
        })
    }
}
