import ArgoEngine
import Foundation

/// The transcripts the cockpit is judged against, and the builders they are written with.
///
/// One name for the whole catalog, so a caller says `TranscriptFixtures.workedOn` without knowing
/// which file holds it. The fixtures themselves stay one subject per file — `+Work` is the work,
/// `+Fold` the stretch of looking, `+Long` the six-hour run — and every one of them is an
/// `extension TranscriptFixtures` under `Shell/Fixtures/`.
///
/// The builders below are non-private BECAUSE they are shared: Swift's `private` inside an
/// extension is file-scoped, so a shard spelling its own would be invisible to its siblings.
enum TranscriptFixtures {
    /// A call the record answered, with whatever it answered with. `nil` for the outcome that
    /// carried no result at all, which is a real shape and not a missing one.
    static func finished(_ id: String, _ result: ToolResult?) -> ToolCallOutcome {
        ToolCallOutcome(
            id: id,
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: result,
                endedAtMs: nil,
            ),
            delegated: ToolCallOutcome.Delegated(usage: nil),
        )
    }

    /// The same outcome with its result pre-wrapped as printed output — a read, a command, a
    /// fetch, a skill body, a settled question. The shape most of the catalog is made of.
    static func printed(_ id: String, _ text: String) -> ToolCallOutcome {
        finished(id, .output(OutputEvidence(tier: .direct, text: text)))
    }

    /// A call that reported what it spent — the delegating call, which is the only one that ever
    /// does. Its result is the Subagent's whole sidechain, priced.
    ///
    /// It names the Subagent where the caller asks: the id and the spend arrive together, on the
    /// one record that answers a handover. `reportedMs` is the host's own measure of that run,
    /// which is the only place the figure is ever stated.
    static func spent(
        _ id: String,
        _ usage: Usage,
        subagent: String? = nil,
        reportedMs: Int? = nil,
    )
        -> ToolCallOutcome {
        ToolCallOutcome(
            id: id,
            resolution: ToolCallOutcome.Resolution(
                status: .completed,
                result: nil,
                endedAtMs: nil,
            ),
            delegated: ToolCallOutcome.Delegated(
                usage: usage,
                subagentID: subagent,
                reportedDurationMs: reportedMs,
            ),
        )
    }

    /// A delegation that came back, priced and timed — the two figures the rail draws on a chip.
    /// The tokens land as cache reads, where a real Subagent's spend mostly sits.
    static func landed(_ id: String, tokens: Int, seconds: Int) -> ToolCallOutcome {
        spent(
            id,
            Usage(
                inputTokens: 0,
                outputTokens: 0,
                cacheReadTokens: tokens,
                cacheCreationTokens: 0,
            ),
            reportedMs: seconds * 1000,
        )
    }

    /// A transcript writes base64 as one unbroken run; source cannot hold a 1000-character line.
    /// The wrapping is the fixture's, so it comes off here rather than in the decoder: production
    /// bytes have no newlines and nothing should tolerate any.
    static func unwrapped(_ wrapped: String) -> String {
        wrapped.replacingOccurrences(of: "\n", with: "")
    }

    /// When an unanswered delegation was handed over, relative to NOW rather than to the rest of
    /// the catalog's Dec-2024 clock.
    ///
    /// Their chips count UP from this, so a fixed moment in the past would draw a Subagent that
    /// has been running for eight months. The reading either side of it is unaffected: nothing in
    /// the feed words a delegation's age, and the rail is the one surface that counts.
    static func handedOver(_ secondsAgo: Int) -> Int {
        Date().epochMs - secondsAgo * 1000
    }
}
