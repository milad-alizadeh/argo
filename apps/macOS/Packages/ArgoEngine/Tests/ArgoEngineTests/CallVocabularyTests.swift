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

    /// A skill is its own kind and is targeted by the skill's NAME. Read as an `execute` it said
    /// "Ran Skill" on every row, which names the mechanism and never the thing that ran.
    @Test
    func `a skill is read as a skill, named by the one it invoked`() async throws {
        #expect(try await calls()["call-skill"]?.kind == .skill)
        #expect(try await calls()["call-skill"]?.target == "grill")
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

    /// A failure is carried WHOLE. Nothing picks a line out of it any more: the surface that shows
    /// a failure shows all of it, and every rule for choosing one line was a rule about which part
    /// of a stack trace explains it — a reading Argo is not entitled to make.
    @Test
    func `a failed command's output is kept whole, with nothing lifted out of it`() async throws {
        let outcomes = try await Fixture.events("callVocabulary").outcomes()
        guard case let .output(output) = try #require(outcomes["call-build"]?.result) else {
            Issue.record("a failed command carries what it printed")
            return
        }

        #expect(output.text.hasPrefix("Exit code 65"))
        #expect(output.text.contains("cannot find type 'ArgoColour' in scope"))
    }

    /// A read's payload is the file as the agent saw it, and it is held for the same reason media
    /// bytes are: re-reading the path later shows what the file says NOW, which after three edits
    /// in one turn is a different file.
    @Test
    func `a successful read keeps what the agent was looking at`() async throws {
        let outcomes = try await Fixture.events("callVocabulary").outcomes()
        guard case let .output(output) = try #require(outcomes["call-read"]?.result) else {
            Issue.record("a read carries the content it returned")
            return
        }

        #expect(output.tier == .direct)
        #expect(output.text.contains("public enum ArgoSymbol"))
    }
}
