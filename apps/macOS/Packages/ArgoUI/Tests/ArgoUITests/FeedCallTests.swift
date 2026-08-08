import ArgoEngine
@testable import ArgoUI
import Testing

/// A call is one sentence: a mark, a verb, the thing it named. These are the claims that sentence
/// makes — that each kind is said in its own words, that the subject is never a path, and that
/// neither the second line nor the disclosure is offered unless the record earned it.
@Suite("Feed call")
struct FeedCallTests {
    // MARK: - The vocabulary

    @Test
    func `each kind is said in its own verb, under its own mark`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("search", "Grep", .search, "connectionState")),
            .toolCall(FeedFixture.call("read", "Read", .read, "Token.swift")),
            .toolCall(FeedFixture.call("run", "Bash", .execute, "swift build")),
            .toolCall(FeedFixture.call("fetch", "WebFetch", .fetch, "developer.apple.com")),
            .toolCall(FeedFixture.call("task", "Task", .delegate, "review the feed")),
            .toolCall(FeedFixture.call("mcp", "mcp__linear__list_issues", .mcp, nil)),
        ])

        #expect(calls.map(\.kind.verb) == [
            "Searched", "Read", "Ran", "Fetched", "Delegated", "Called",
        ])
        #expect(calls.allSatisfy { $0.kind.symbol != nil })
        #expect(Set(calls.compactMap(\.kind.symbol)).count == calls.count)
    }

    @Test
    func `a mutation says which mutation it was, rather than leaving it to the diffstat`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("edit", "Edit", .edit, "Feed.swift")),
            .toolCallOutcome(FeedFixture.answered("edit", FeedFixture.patch(.modify, added: 8))),
            .toolCall(FeedFixture.call("create", "Write", .edit, "New.swift")),
            .toolCallOutcome(FeedFixture.answered("create", FeedFixture.patch(.create, added: 39))),
            .toolCall(FeedFixture.call("delete", "Write", .edit, "Old.swift")),
            .toolCallOutcome(FeedFixture.answered(
                "delete",
                FeedFixture.patch(.delete, removed: 61),
            )),
        ])

        #expect(calls.map(\.kind.verb) == ["Edited", "Created", "Deleted"])
        #expect(calls.map { $0.churn?.added } == [8, 39, 0])
        #expect(calls.map { $0.churn?.removed } == [0, 0, 61])
    }

    @Test
    func `a move says where the file went, and says it as briefly as everything else`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("move", "Edit", .edit, "Shell/Tint.swift")),
            .toolCallOutcome(FeedFixture.answered("move", FeedFixture.patch(
                .move,
                destination: "VisualContract/Tint.swift",
            ))),
        ])

        #expect(calls.map(\.kind.verb) == ["Moved"])
        // The folder it landed in, not the path it landed at: a feed that shows no paths may not
        // make one exception for the row that happens to have two of them.
        #expect(calls.first?.kind.destination == "VisualContract")
    }

    /// The one case where a mark would be a claim nothing supports. The host's own name is what is
    /// known, so the host's own name is what the row says.
    @Test
    func `a kind Argo cannot classify keeps the host's tool name and takes no mark`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("strange", "custom_tool_v2", .other, nil)),
        ])

        #expect(calls.first?.kind == .unclassified)
        #expect(calls.first?.kind.symbol == nil)
        #expect(calls.first?.subject == .plain("custom_tool_v2"))
    }

    @Test
    func `an MCP call is addressed by the server and tool the host named`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("mcp", "mcp__linear__list_issues", .mcp, "anything")),
        ])

        #expect(calls.first?.subject == .plain("linear · list_issues"))
    }

    // MARK: - The subject is a filename, never a path

    @Test
    func `a file is named by its filename alone, and a unique name carries no qualifier`() throws {
        let path = "Packages/ArgoUI/Sources/Shell/Deck/FeedView.swift"
        let file = try #require(fileName(of: FeedFixture.read(path).first))

        #expect(file.name == "FeedView.swift")
        #expect(file.qualifier == nil)
        // The path is kept — the evidence panel opens on it — and never drawn.
        #expect(file.path == path)
    }

    @Test
    func `two files of one name take the shortest parent that tells them apart`() {
        let calls = FeedFixture.read("Shell/Deck/FeedView.swift", "Specimen/FeedView.swift")

        #expect(calls.compactMap { fileName(of: $0)?.name } == ["FeedView.swift", "FeedView.swift"])
        #expect(calls.compactMap { fileName(of: $0)?.qualifier } == ["Deck", "Specimen"])
    }

    /// Ambiguity is a fact about the feed a row sits in, so the same call in a feed with no rival
    /// draws no qualifier at all.
    @Test
    func `a name is qualified against the feed it is in, not against its own path`() {
        let alone = FeedFixture.read("Shell/Deck/FeedView.swift")

        #expect(fileName(of: alone.first)?.qualifier == nil)
    }

    @Test
    func `a command is the subject a command names, and a call that named nothing takes its tool`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", "Bash", .execute, "swift build")),
            .toolCall(FeedFixture.call("quiet", "local command", .execute, nil)),
        ])

        #expect(calls.map(\.subject) == [.command("swift build"), .plain("local command")])
    }

    // MARK: - Failure

    @Test
    func `a failed command shows its exit status and exactly one line beneath it`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("build", "Bash", .execute, "swift build")),
            .toolCallOutcome(FeedFixture.failed(
                "build",
                printing: "Exit code 65\n\nChip.swift:88:7: error: cannot convert value\n"
                    + "    to expected argument type\n** BUILD FAILED **",
            )),
        ])

        #expect(calls.first?.failure?.status == "Exit code 65")
        #expect(calls.first?.failure?.diagnostic == "Chip.swift:88:7: error: cannot convert value")
    }

    @Test
    func `a failure with nothing trustworthy to say shows only that it failed`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("build", "Bash", .execute, "swift build")),
            .toolCallOutcome(FeedFixture.failed("build", printing: nil)),
        ])

        #expect(calls.first?.failure == CommandFailure(status: nil, diagnostic: nil))
    }

    @Test
    func `a call that succeeded reduces to one line`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", "Bash", .execute, "swift test")),
            .toolCallOutcome(FeedFixture.answered(
                "run",
                .output(OutputEvidence(tier: .direct, text: "148 passed")),
            )),
        ])

        #expect(calls.first?.failure == nil)
    }

    // MARK: - Disclosure

    /// The marker follows the EVIDENCE, not the kind: two reads of the same file, one answered by
    /// the record and one not, are two different rows.
    @Test
    func `a row offers disclosure exactly where the engine stored something behind it`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("kept", "Read", .read, "Token.swift")),
            .toolCallOutcome(FeedFixture.answered(
                "kept",
                .output(OutputEvidence(tier: .direct, text: "1\texport const token = 1")),
            )),
            .toolCall(FeedFixture.call("dropped", "Read", .read, "Other.swift")),
            .toolCallOutcome(FeedFixture.answered("dropped", nil)),
            .toolCall(FeedFixture.call("open", "Read", .read, "Third.swift")),
        ])

        #expect(calls.map(\.disclosure) == [.available, .none, .none])
    }

    // MARK: -

    private func fileName(of call: FeedCall?) -> FeedCall.FileName? {
        guard case let .file(file) = call?.subject else { return nil }
        return file
    }
}
