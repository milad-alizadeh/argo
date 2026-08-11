@testable import ArgoEngine
import Testing

/// The agent's own account of what a call was for, read as a fact of its OWN — beside the target
/// rather than instead of it, verbatim, and absent wherever the host wrote nothing.
@Suite("Narration reading")
struct NarrationReadingTests {
    private func calls() async throws -> [String: ToolCall] {
        try await Fixture.events("narration").reduce(into: [:]) { found, event in
            guard case let .toolCall(call) = event else { return }
            found[call.id] = call
        }
    }

    @Test
    func `a command carries the host's own description of what it was for`() async throws {
        #expect(try await calls()["call-described"]?.narration == "List open issues")
    }

    /// The two must not compete for one slot: a description written into `target` would take the
    /// command off the evidence panel.
    @Test
    func `the command survives the reading beside the sentence about it`() async throws {
        let described = try await calls()["call-described"]
        #expect(described?.target == "gh issue list --repo milad-alizadeh/argo --limit 20")
    }

    /// The shape a CLI that narrates nothing writes — Codex's shell call carries a command and no
    /// description, ever. Absent rather than empty: two different readings.
    @Test
    func `a host that wrote no description yields no narration`() async throws {
        #expect(try await calls()["call-bare"]?.narration == nil)
        #expect(try await calls()["call-bare"]?.target
            == "swift build --package-path Packages/ArgoUI")
    }

    @Test
    func `a description with nothing in it is no narration`() async throws {
        #expect(try await calls()["call-blank"]?.narration == nil)
    }

    /// The rule is not a fact about `Bash`.
    @Test
    func `every tool that carries a description is read the same way`() async throws {
        let calls = try await calls()

        #expect(calls["call-agent"]?.narration == "Review the feed's call reading")
        #expect(calls["call-workflow"]?.narration == "Fan the review out across four axes")
        #expect(calls["call-artifact"]?.narration == "Publish the feed's legibility report")
        #expect(calls["call-task"]?.narration
            == "Read the host's description as a fact on the Tool Call")
    }

    /// A delegation's brief is a paragraph and its description is a line; the narration is the
    /// line.
    @Test
    func `a delegation's narration is the short description and never the brief`() async throws {
        let delegated = try await calls()["call-agent"]

        #expect(delegated?.narration == "Review the feed's call reading")
        #expect(delegated?.narration?.contains("Read every file under") == false)
    }

    /// `Artifact` names a file AND says what it was for: the two are read from different keys.
    @Test
    func `a call that names a file keeps the file as its target`() async throws {
        #expect(try await calls()["call-artifact"]?.target == "scratchpad/feed-report.html")
    }
}
