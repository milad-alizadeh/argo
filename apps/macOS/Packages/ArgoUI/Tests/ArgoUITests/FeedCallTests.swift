import ArgoEngine
@testable import ArgoUI
import Testing

/// The words a call line is built out of: one verb and one mark per kind of thing the agent did,
/// and no mark at all for the one case where Argo does not know what it did.
@Suite("Feed call vocabulary")
struct FeedCallTests {
    @Test
    func `each kind is said in its own verb, under its own mark`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "search",
                tool: "Grep",
                kind: .search,
                naming: "connectionState",
            )),
            .toolCall(FeedFixture.call("read", tool: "Read", kind: .read, naming: "Token.swift")),
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift build")),
            .toolCall(FeedFixture.call(
                "fetch",
                tool: "WebFetch",
                kind: .fetch,
                naming: "developer.apple.com",
            )),
            .toolCall(FeedFixture.call(
                "task",
                tool: "Task",
                kind: .delegate,
                naming: "review the feed",
            )),
            .toolCall(FeedFixture.call("skill", tool: "Skill", kind: .skill, naming: "grill")),
            .toolCall(FeedFixture.call("mcp", tool: "mcp__linear__list_issues", kind: .mcp)),
        ])

        #expect(calls.map(\.kind.verb) == [
            "Searched", "Read", "Ran", "Fetched", "Delegated", "Invoked", "Called",
        ])
        #expect(calls.allSatisfy { $0.kind.symbol != nil })
        #expect(Set(calls.compactMap(\.kind.symbol)).count == calls.count)
    }

    @Test
    func `a mutation says which mutation it was, rather than leaving it to the diffstat`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("edit", tool: "Edit", kind: .edit, naming: "Feed.swift")),
            .toolCallOutcome(TranscriptFixtures.finished(
                "edit",
                FeedFixture.patch(.modify, added: 8),
            )),
            .toolCall(FeedFixture.call("create", tool: "Write", kind: .edit, naming: "New.swift")),
            .toolCallOutcome(TranscriptFixtures.finished(
                "create",
                FeedFixture.patch(.create, added: 39),
            )),
            .toolCall(FeedFixture.call("delete", tool: "Write", kind: .edit, naming: "Old.swift")),
            .toolCallOutcome(TranscriptFixtures.finished(
                "delete",
                FeedFixture.patch(.delete, removed: 61),
            )),
        ])

        #expect(calls.map(\.kind.verb) == ["Edited", "Created", "Deleted"])
        #expect(calls.map { $0.churn?.added } == [8, 39, 0])
        #expect(calls.map { $0.churn?.removed } == [0, 0, 61])
    }

    @Test
    func `a move says the file moved and leaves where to for the panel`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "move",
                tool: "Edit",
                kind: .edit,
                naming: "Shell/Tint.swift",
            )),
            .toolCallOutcome(TranscriptFixtures.finished("move", FeedFixture.patch(
                .move,
                destination: "VisualContract/Tint.swift",
            ))),
        ])

        #expect(calls.map(\.kind.verb) == ["Moved"])
        // The filename alone, with nothing trailing it. A destination after the name was a second
        // cut address on the one row that already had one, in a feed that shows no paths at all.
        #expect(calls.first?.subject.captioned == "Tint.swift")
    }

    /// The one case where a mark would be a claim nothing supports. The host's own name is what is
    /// known, so the host's own name is what the row says.
    @Test
    func `a kind Argo cannot classify keeps the host's tool name and takes no mark`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("strange", tool: "custom_tool_v2", kind: .other)),
        ])

        #expect(calls.first?.kind == .unclassified)
        #expect(calls.first?.kind.symbol == nil)
        #expect(calls.first?.subject == .plain("custom_tool_v2"))
    }
}
