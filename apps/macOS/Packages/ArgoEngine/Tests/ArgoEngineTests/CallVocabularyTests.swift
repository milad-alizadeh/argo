@testable import ArgoEngine
import Testing

// The words a call line is built out of: which KIND a tool name is read as, what a declared move
// says about where the file went, and which of a failure's own lines a row is entitled to show.

@Suite("Call vocabulary")
struct CallVocabularyTests {
    private func calls() async throws -> [String: ToolCall] {
        try await Fixture.events("callVocabulary").reduce(into: [:]) { found, event in
            guard case let .toolCall(call) = event else { return }
            found[call.id] = call
        }
    }

    @Test
    func `a tool reached over MCP is read from the host's own name for it`() async throws {
        #expect(try await calls()["call-mcp"]?.kind == .mcp)
        #expect(try await calls()["call-mcp"]?.name == "mcp__linear__list_issues")
    }

    @Test
    func `a tool nothing recognises stays unclassified, never the nearest kind`() async throws {
        #expect(try await calls()["call-strange"]?.kind == .other)
        #expect(try await calls()["call-strange"]?.name == "custom_tool_v2")
    }

    @Test
    func `a move is read only where the host declares one, and carries where it went`(
    ) async throws {
        let outcomes = try await Fixture.events("callVocabulary").outcomes()
        guard case let .diff(diff) = try #require(outcomes["call-move"]?.result) else {
            Issue.record("a declared move is a change to a file, so it is read as a patch")
            return
        }

        #expect(diff.change == .move)
        #expect(diff.destination == "Sources/ArgoUI/VisualContract/Tint.swift")
    }

    @Test
    func `a failure's exit line and its first real line are read apart`() async throws {
        let outcomes = try await Fixture.events("callVocabulary").outcomes()
        guard case let .output(output) = try #require(outcomes["call-build"]?.result) else {
            Issue.record("a failed command carries what it printed")
            return
        }
        let failure = commandFailure(in: output.text)

        #expect(failure.status == "Exit code 65")
        #expect(failure
            .diagnostic == "Tint.swift:12:7: error: cannot find type 'ArgoColour' in scope")
    }

    @Test
    func `a failure that printed nothing but its status has no diagnostic to show`() {
        #expect(commandFailure(in: "Exit code 1\n") == CommandFailure(
            status: "Exit code 1",
            diagnostic: nil,
        ))
    }

    @Test
    func `a failure with no exit line reads its first line as the diagnostic`() {
        #expect(commandFailure(in: "File does not exist.") == CommandFailure(
            status: nil,
            diagnostic: "File does not exist.",
        ))
    }

    @Test
    func `a failure that printed nothing at all claims neither`() {
        #expect(commandFailure(in: "   \n\n") == CommandFailure(status: nil, diagnostic: nil))
    }
}
