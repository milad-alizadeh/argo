import ArgoEngine
@testable import ArgoUI
import Testing

/// What a call line names. The claim under all of these is that a path never reaches the feed: the
/// filename is the whole address, and the address it stood for waits for the evidence panel.
@Suite("Feed call subject")
struct FeedCallSubjectTests {
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
    func `a command is the subject a command names, and one that named nothing takes its tool`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift build")),
            .toolCall(FeedFixture.call("quiet", tool: "local command", kind: .execute)),
        ])

        #expect(calls.map(\.subject) == [.command("swift build"), .plain("local command")])
    }

    /// The one thing worth saying about a skill is WHICH one. Named by its tool it read "Ran Skill"
    /// on every row, which is the mechanism, and the same words whether the agent invoked `grill`
    /// or `implement`. The panel behind it is the instructions the skill handed back.
    @Test
    func `a skill is named by the skill, never by the tool that loaded it`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("skill", tool: "Skill", kind: .skill, naming: "grill")),
        ])

        #expect(calls.first?.subject == .plain("grill"))
        #expect(calls.first?.kind.verb == "Invoked")
    }

    /// The engine scrapes a target out of whichever field a tool happened to use, and for a kind
    /// nobody classified that field means nothing. The tool's name is what is known.
    @Test
    func `an unclassified call is named by its tool even when it carried an argument`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "strange",
                tool: "custom_tool_v2",
                kind: .other,
                naming: "whatever it does",
            )),
        ])

        #expect(calls.first?.subject == .plain("custom_tool_v2"))
    }

    @Test
    func `an MCP call is addressed by the server and tool the host named`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "mcp",
                tool: "mcp__linear__list_issues",
                kind: .mcp,
                naming: "anything",
            )),
        ])

        #expect(calls.first?.subject == .plain("linear · list_issues"))
    }

    // MARK: - Addresses, said from where the Session is standing

    /// Inside a Session everything is relative to that Session's cwd, so the prefix is thirty
    /// characters of this machine before the first character about the work — and it is the half
    /// that pushes the informative end of a long address off the edge of the panel.
    @Test
    func `an address inside the Session's own tree is said relative to it`() {
        let calls = FeedFixture.calls(in: [
            .cwd("/Users/x/argo"),
            .toolCall(FeedFixture.call(
                "read",
                tool: "Read",
                kind: .read,
                naming: "/Users/x/argo/Sources/Feed.swift",
            )),
        ])

        #expect(fileName(of: calls.first)?.path == "Sources/Feed.swift")
    }

    /// A path OUTSIDE the tree keeps its shape — it is genuinely elsewhere, and that is worth
    /// seeing. A command is shortened too: it carries paths in the middle of its own words.
    @Test
    func `a command's own words are shortened the same way`() {
        let calls = FeedFixture.calls(in: [
            .cwd("/Users/x/argo"),
            .toolCall(FeedFixture.call(
                "run",
                tool: "Bash",
                kind: .execute,
                naming: "swift build --package-path /Users/x/argo/apps/macOS",
            )),
        ])

        #expect(calls.first?.subject == .command("swift build --package-path apps/macOS"))
    }

    private func fileName(of call: FeedCall?) -> FeedCall.FileName? {
        guard case let .file(file) = call?.subject else { return nil }
        return file
    }
}
