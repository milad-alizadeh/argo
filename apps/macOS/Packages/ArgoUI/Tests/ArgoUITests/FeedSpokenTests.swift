import ArgoEngine
@testable import ArgoUI
import Testing

/// What the feed says out loud.
///
/// A screen reader arrives at one row at a time with nothing beside it to compare — no column to
/// scan, no ink to read a failure off, no chevron to see. Everything the drawn row says in shape
/// and colour has to survive as words, and everything the drawn row leaves to its neighbours has to
/// be said again here.
@Suite("Feed spoken labels")
struct FeedSpokenTests {
    @Test
    func `a row says what the agent did and what it did it to`() throws {
        let call = try #require(FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("read", tool: "Read", kind: .read, naming: "src/token.ts")),
            .toolCallOutcome(FeedFixture.answered(
                "read",
                .output(OutputEvidence(tier: .direct, text: "let token = 1")),
            )),
        ]).first)

        #expect(call.spoken == "Read token.ts")
    }

    /// The drawn row stopped naming the parent (#422) because two rows side by side made the
    /// qualifier read as a second word rather than as disambiguation. Nothing is side by side in
    /// the ear, so this is the only place the two files are told apart at all.
    @Test
    func `a filename the feed had to qualify speaks its qualifier`() {
        let calls = FeedFixture.read("cockpit/Feed.swift", "roster/Feed.swift")

        #expect(calls.map(\.spoken) == [
            "Read cockpit/Feed.swift still running",
            "Read roster/Feed.swift still running",
        ])
    }

    /// A failure is drawn as the line in the failure ink and a mark. Neither carries, so the word
    /// is the whole of what a listener gets.
    @Test
    func `a call that failed says so`() throws {
        let call = try #require(FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift test")),
            .toolCallOutcome(FeedFixture.failed("run", printing: "1 test failed")),
        ]).first)

        #expect(call.spoken.contains("failed"))
    }

    /// A call the record has not answered HAPPENED, and a row that spoke as though it were over
    /// would be the feed's first lie in the one channel that cannot see the pending mark.
    @Test
    func `a call still running says so`() throws {
        let call = try #require(FeedFixture.read("src/token.ts").first)

        #expect(call.spoken.contains("still running"))
    }

    /// A collapsed run draws `×3`. Read as a symbol that is either silence or "times three" with
    /// no noun, so the count is spelled in words.
    @Test
    func `a collapsed run says how many calls it stands for`() throws {
        let edits = (0 ..< 3).flatMap { position -> [TranscriptEvent] in
            let id = "edit-\(position)"
            return [
                .toolCall(FeedFixture.call(id, tool: "Edit", kind: .edit, naming: "Feed.swift")),
                .toolCallOutcome(FeedFixture.answered(id, FeedFixture.patch(.modify, added: 1))),
            ]
        }
        let call = try #require(FeedFixture.calls(in: edits).first)

        #expect(call.spoken == "Edited Feed.swift 3 times")
    }

    /// The folded line draws `Searched 1 · Read 5` and nothing else. The verb the counts stand for
    /// is never drawn, so without it a listener hears two numbers and no claim.
    @Test
    func `a folded run of looking says what the counts are counts of`() throws {
        let rows = FeedProjection.rows(from: (0 ..< 3).flatMap { position -> [TranscriptEvent] in
            let id = "read-\(position)"
            return [
                .toolCall(FeedFixture.call(
                    id,
                    tool: "Read",
                    kind: .read,
                    naming: "file\(position).swift",
                )),
                .toolCallOutcome(FeedFixture.answered(
                    id,
                    .output(OutputEvidence(tier: .direct, text: "let token = 1")),
                )),
            ]
        })
        let survey = try #require(FeedFixture.surveys(in: rows).first)

        #expect(survey.spoken == "Looked at Read 3")
    }
}
