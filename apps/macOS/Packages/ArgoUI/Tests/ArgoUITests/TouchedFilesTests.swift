import ArgoEngine
@testable import ArgoUI
import Testing

/// Which files the `@` menu sorts to the top, read off the transcript the feed already draws
/// (#687).
@Suite("Touched files")
struct TouchedFilesTests {
    private static let root = "/Users/milad/Developer/argo"

    @Test
    func `a read and an edit both count as having been in a file`() {
        let touched = TouchedFiles.touched(
            in: [call(.read, "README.md"), call(.edit, "AGENTS.md")],
            within: nil,
        )

        #expect(Set(touched) == ["README.md", "AGENTS.md"])
    }

    /// Newest first, because the file the reader means next is the one the agent was just in.
    @Test
    func `the newest touch leads`() {
        let touched = TouchedFiles.touched(
            in: [call(.read, "first.md"), call(.edit, "second.md")],
            within: nil,
        )

        #expect(touched == ["second.md", "first.md"])
    }

    @Test
    func `a file touched twice is listed once, at its newest`() {
        let touched = TouchedFiles.touched(
            in: [call(.read, "a.md"), call(.read, "b.md"), call(.edit, "a.md")],
            within: nil,
        )

        #expect(touched == ["a.md", "b.md"])
    }

    /// A search names a pattern and an execute names a command. Neither is a file the reader
    /// could then mention, so neither counts.
    @Test(arguments: [ToolCallKind.search, .execute, .delegate, .plan, .mcp, .skill, .other])
    func `only a read or an edit counts`(_ kind: ToolCallKind) {
        #expect(TouchedFiles.touched(in: [call(kind, "README.md")], within: nil).isEmpty)
    }

    /// The tree lists relative paths, so a touch has to be said the same way or it never matches
    /// the row it is meant to lift.
    @Test
    func `an absolute path inside the Workspace is said relative to it`() {
        let touched = TouchedFiles.touched(
            in: [call(.read, "\(Self.root)/docs/adr/ADR-0027.md")],
            within: Self.root,
        )

        #expect(touched == ["docs/adr/ADR-0027.md"])
    }

    /// It stands as it is, and then simply never matches a listed file — which is what keeps a
    /// path outside the Workspace out of the picker.
    @Test
    func `a path outside the Workspace is left absolute`() {
        let touched = TouchedFiles.touched(in: [call(.read, "/etc/hosts")], within: Self.root)

        #expect(touched == ["/etc/hosts"])
    }

    @Test
    func `a call that named nothing contributes nothing`() {
        let call = ToolCall(id: "1", name: "Read", kind: .read, target: nil, atMs: nil)

        #expect(TouchedFiles.touched(in: [.toolCall(call)], within: nil).isEmpty)
    }

    private func call(_ kind: ToolCallKind, _ target: String) -> TranscriptEvent {
        .toolCall(ToolCall(id: target, name: "Tool", kind: kind, target: target, atMs: nil))
    }
}
