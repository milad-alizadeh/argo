import ArgoEngine
import ArgoFixtures
@testable import ArgoUI

/// Calls as a transcript writes them — an emitted call, and the outcome that answers it some
/// records later. Every fixture here is a pair, so the reading still has to find its result.
///
/// The outcome builders themselves are `TranscriptFixtures`' — `finished`, `looked` and `spent`
/// are declared once, beside the previews that read the same shapes (#757).
enum FeedFixture {
    static func call(
        _ id: String,
        tool: String,
        kind: ToolCallKind,
        naming target: String? = nil,
        saying narration: String? = nil,
    )
        -> ToolCall {
        ToolCall(id: id, name: tool, kind: kind, target: target, narration: narration, atMs: nil)
    }

    /// The question tool, carrying a question. The id `ask` is what an outcome answering it quotes.
    static func asking(_ questions: Ask.Question...) -> ToolCall {
        ToolCall(
            id: "ask",
            name: ToolCall.askUserQuestion,
            kind: .other,
            target: nil,
            atMs: nil,
            ask: Ask(questions: questions),
        )
    }

    static func failed(_ id: String, printing output: String?) -> ToolCallOutcome {
        ToolCallOutcome(
            id: id,
            resolution: ToolCallOutcome.Resolution(
                status: .failed,
                result: output.map { .output(OutputEvidence(tier: .direct, text: $0)) },
                endedAtMs: nil,
            ),
        )
    }

    /// A patch, with a hunk in it unless the fixture is asking for one nothing could read. A change
    /// with no readable patch is a row that does not open.
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
            mutation: DiffEvidence.Mutation(change: change, destination: destination),
            patch: DiffEvidence.Patch(added: added, removed: removed, hunks: hunks),
        ))
    }

    /// A picture as a record answers a call with one. `bytes: nil` is the call the record answered
    /// without any — the honest absence, and the only shot that opens nothing.
    static func shot(_ tier: Tier, bytes: String? = onePixelPNG) -> ToolResult {
        .media(MediaEvidence(tier: tier, mediaType: "image/png", bytes: bytes.map { .held($0) }))
    }

    static let onePixelPNG = TranscriptFixtures.onePixelPNG

    /// Two handovers, the second answered: one Subagent still working and one landed, which is the
    /// pair every claim about the rail is made against. Shared, because two suites make claims
    /// about the same two chips — the projection's, and the rail's own.
    static func handedOver(subagent: String? = nil) -> [TranscriptEvent] {
        [
            .toolCall(call("away", tool: "Task", kind: .delegate, naming: "review")),
            .toolCall(call("back", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(TranscriptFixtures.spent("back", delegated, subagent: subagent)),
        ]
    }

    /// What a landed delegation's result reported spending — the whole child's subtree, priced.
    static let delegated = Usage(
        inputTokens: 1200,
        outputTokens: 3400,
        cacheReadTokens: 139_000,
        cacheCreationTokens: 0,
    )

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
            .toolCallOutcome(TranscriptFixtures.finished("shot-\(path)", result)),
        ]
    }

    /// A run of such pairs, one per path — the shape a gallery folds out of.
    static func looked(at paths: [String]) -> [TranscriptEvent] {
        paths.flatMap { looked(at: $0, shot(.direct)) }
    }

    /// Every call a stream produced, in order. Reaches INSIDE a folded run of looking; whether a
    /// call got a line of its own is `surveys(in:)`'s claim.
    static func calls(in events: [TranscriptEvent]) -> [FeedCall] {
        // A gallery keeps its pictures and drops the sentence that carried them; those are
        // asserted through `galleries(in:)`, `asks(in:)`, `marks(in:)` and `unreadable(in:)`.
        FeedProjection.rows(from: events).flatMap(\.content.calls)
    }

    /// Every card of a Turn's work a stream folded, in order.
    static func work(in rows: [FeedRow]) -> [FeedWork] {
        rows.compactMap { row in
            guard case let .work(work) = row.content else { return nil }
            return work
        }
    }

    /// Every question a stream put, in order.
    static func asks(in rows: [FeedRow]) -> [FeedAsk] {
        rows.compactMap { row in
            guard case let .ask(ask) = row.content else { return nil }
            return ask
        }
    }

    /// Every mark a stream punctuated its reading with, in order.
    static func marks(in rows: [FeedRow]) -> [FeedMark] {
        rows.compactMap { row in
            guard case let .mark(mark) = row.content else { return nil }
            return mark
        }
    }

    /// Every stretch the reader could not parse, in order.
    static func unreadable(in rows: [FeedRow]) -> [FeedUnreadable] {
        rows.compactMap { row in
            guard case let .unreadable(unreadable) = row.content else { return nil }
            return unreadable
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
