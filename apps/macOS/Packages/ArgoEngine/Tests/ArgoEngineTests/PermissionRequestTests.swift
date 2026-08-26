@testable import ArgoEngine
import Testing

/// The hook's payload read into the domain: the tool by name, its target verbatim, and nothing
/// invented for a shape the vocabulary does not know.
@Suite("Permission request")
struct PermissionRequestTests {
    private func read(_ line: String) -> PermissionRequest? {
        PermissionRequest.Draft(line: line)?.minted(as: "perm-1")
    }

    @Test
    func `a Bash call is a command, verbatim and in full`() throws {
        let line = """
        {"tool_name":"Bash","tool_input":{"command":"swift test --filter Roster 2>&1 | tail -40"}}
        """
        let request = try #require(read(line))

        #expect(request.toolName == "Bash")
        #expect(request.target == .command("swift test --filter Roster 2>&1 | tail -40"))
    }

    @Test
    func `an Edit call is the path and the hunk it would write`() throws {
        let line = """
        {"tool_name":"Edit","tool_input":{"file_path":"Sources/Feed.swift",\
        "old_string":"let anchor = rows.last?.id","new_string":"let anchor = projection.anchorID"}}
        """
        let request = try #require(read(line))

        #expect(request.target == .edit(path: "Sources/Feed.swift", hunks: [[
            DiffLine(side: .del, text: "let anchor = rows.last?.id"),
            DiffLine(side: .add, text: "let anchor = projection.anchorID"),
        ]]))
    }

    @Test
    func `a Write call is the path and every line it would create`() throws {
        let line = """
        {"tool_name":"Write","tool_input":{"file_path":"notes.md","content":"one\\ntwo"}}
        """
        let request = try #require(read(line))

        #expect(request.target == .edit(path: "notes.md", hunks: [[
            DiffLine(side: .add, text: "one"),
            DiffLine(side: .add, text: "two"),
        ]]))
    }

    @Test
    func `a MultiEdit call carries one hunk per edit`() throws {
        let line = """
        {"tool_name":"MultiEdit","tool_input":{"file_path":"a.swift","edits":[\
        {"old_string":"first","new_string":"1st"},{"old_string":"second","new_string":"2nd"}]}}
        """
        let request = try #require(read(line))

        #expect(request.target == .edit(path: "a.swift", hunks: [
            [DiffLine(side: .del, text: "first"), DiffLine(side: .add, text: "1st")],
            [DiffLine(side: .del, text: "second"), DiffLine(side: .add, text: "2nd")],
        ]))
    }

    @Test
    func `a tool outside the vocabulary keeps its input verbatim rather than a guessed shape`(
    ) throws {
        let line = """
        {"tool_name":"WebFetch","tool_input":{"url":"https://example.com"}}
        """
        let request = try #require(read(line))

        #expect(request.toolName == "WebFetch")
        guard case let .raw(input) = request.target else {
            Issue.record("expected a raw target")
            return
        }
        #expect(input.contains("https://example.com"))
    }

    @Test
    func `a payload with no tool name is refused, never a nameless prompt`() {
        #expect(read(#"{"tool_input":{"command":"ls"}}"#) == nil)
        #expect(read("not json") == nil)
    }
}
