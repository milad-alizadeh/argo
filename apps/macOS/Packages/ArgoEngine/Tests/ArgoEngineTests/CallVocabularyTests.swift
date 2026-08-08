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

    /// The status alone. What went wrong is the whole output's to say, and the surface that shows
    /// it shows all of it — so nothing here picks a line to stand for the failure.
    @Test
    func `a failed command's exit line is read, and the rest is left whole`() async throws {
        let outcomes = try await Fixture.events("callVocabulary").outcomes()
        guard case let .output(output) = try #require(outcomes["call-build"]?.result) else {
            Issue.record("a failed command carries what it printed")
            return
        }

        #expect(commandExitStatus(in: output.text) == "Exit code 65")
        #expect(output.text.contains("cannot find type 'ArgoColour' in scope"))
    }

    @Test
    func `a failure the host opened with no exit line claims no status`() {
        #expect(commandExitStatus(in: "File does not exist.") == nil)
        #expect(commandExitStatus(in: "   \n\n") == nil)
    }

    /// Anchored at both ends: a line that merely mentions an exit code is not the exit line.
    @Test
    func `only a line that IS the exit line is read as one`() {
        #expect(commandExitStatus(in: "Exit code 1\n") == "Exit code 1")
        #expect(commandExitStatus(in: "make: Exit code 1 was returned") == nil)
    }

    @Test
    func `a command's outcome is the last line it actually printed`() {
        #expect(commandOutcome(in: "one\ntwo\n\n  \n") == "two")
        #expect(commandOutcome(in: "  \n") == nil)
    }
}
