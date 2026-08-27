import ArgoEngine
@testable import ArgoUI
import Testing

/// A run of the same call on the same subject reads as one line. The claims here are about what the
/// collapse is allowed to fuse — and, more importantly, what it is not.
@Suite("Feed call runs")
struct FeedCallRunTests {
    @Test
    func `three edits of one file are one row and three patches`() throws {
        let call = try #require(FeedFixture.calls(in: edits(3, to: "Feed.swift")).first)

        #expect(call.repeats == 3)
        #expect(call.evidence.count == 3)
        // The counts add up, so the row still says how much the run changed in total.
        #expect(call.churn == FeedCall.Churn(added: 3, removed: 3))
    }

    @Test
    func `the feed collapses the run to one row and keeps every other row it had`() {
        let rows = FeedProjection.rows(from: edits(3, to: "Feed.swift"))

        #expect(rows.count == 1)
        #expect(rows.map(\.id) == [0])
    }

    /// The hard limit: fusing two edits with other work between them would put one line in the feed
    /// standing for two moments.
    @Test
    func `two edits with other work between them stay two rows`() {
        let interrupted: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("a", tool: "Edit", kind: .edit, naming: "Feed.swift")),
            .toolCallOutcome(TranscriptFixtures.finished(
                "a",
                FeedFixture.patch(.modify, added: 1),
            )),
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift build")),
            .toolCall(FeedFixture.call("b", tool: "Edit", kind: .edit, naming: "Feed.swift")),
            .toolCallOutcome(TranscriptFixtures.finished(
                "b",
                FeedFixture.patch(.modify, added: 1),
            )),
        ]

        #expect(FeedFixture.calls(in: interrupted).map(\.repeats) == [1, 1, 1])
    }

    /// Same file, different verb: a create and an edit are two claims about what happened.
    @Test
    func `a create and an edit of one file are not the same work`() {
        let mixed: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("a", tool: "Write", kind: .edit, naming: "Feed.swift")),
            .toolCallOutcome(TranscriptFixtures.finished(
                "a",
                FeedFixture.patch(.create, added: 9),
            )),
            .toolCall(FeedFixture.call("b", tool: "Edit", kind: .edit, naming: "Feed.swift")),
            .toolCallOutcome(TranscriptFixtures.finished(
                "b",
                FeedFixture.patch(.modify, added: 1),
            )),
        ]

        let calls = FeedFixture.calls(in: mixed)

        #expect(calls.map(\.kind) == [.create, .edit])
        #expect(calls.map(\.repeats) == [1, 1])
    }

    /// A row reading green because the two edits after the failed one worked would hide the only
    /// thing on the line worth seeing.
    @Test
    func `a failure anywhere in a run is how the whole run reads`() throws {
        let run: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("a", tool: "Bash", kind: .execute, naming: "swift test")),
            .toolCallOutcome(FeedFixture.failed("a", printing: "Exit code 1")),
            .toolCall(FeedFixture.call("b", tool: "Bash", kind: .execute, naming: "swift test")),
            .toolCallOutcome(TranscriptFixtures.printed("b", "ok")),
        ]
        let call = try #require(FeedFixture.calls(in: run).first)

        #expect(call.repeats == 2)
        #expect(call.ending == .failed)
    }

    /// A run still waiting on one of its calls has not succeeded yet either.
    @Test
    func `a run with a call the record has not answered is still pending`() throws {
        let run: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("a", tool: "Read", kind: .read, naming: "Feed.swift")),
            .toolCallOutcome(TranscriptFixtures.printed("a", "1\tlet a = 1")),
            .toolCall(FeedFixture.call("b", tool: "Read", kind: .read, naming: "Feed.swift")),
        ]
        let call = try #require(FeedFixture.calls(in: run).first)

        #expect(call.ending == .pending)
        // One of the two was answered, so the row still opens onto what that one produced.
        #expect(call.evidence.count == 1)
    }

    private func edits(_ count: Int, to path: String) -> [TranscriptEvent] {
        (0 ..< count).flatMap { position -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    "edit-\(position)",
                    tool: "Edit",
                    kind: .edit,
                    naming: path,
                )),
                .toolCallOutcome(TranscriptFixtures.finished(
                    "edit-\(position)",
                    FeedFixture.patch(.modify, added: 1, removed: 1),
                )),
            ]
        }
    }
}
