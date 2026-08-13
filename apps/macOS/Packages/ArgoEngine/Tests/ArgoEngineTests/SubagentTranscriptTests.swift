@testable import ArgoEngine
import Foundation
import Testing

/// Which files a Session's Subagents were written to, found from the Session's own record.
@Suite("Subagent transcripts")
struct SubagentTranscriptTests {
    @Test
    func `a Subagent's transcript is found beside the Session's own record`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        let written = try fixture.write(agent: "a1")

        let found = SubagentTranscripts.beside(fixture.parentURL)

        #expect(found.map(\.agentID) == ["a1"])
        // Resolved on both sides: a directory walk hands back `/private/var/…` where the fixture
        // holds `/var/…`, and the claim here is that it found that file rather than that two URLs
        // spell it the same way.
        #expect(found.map { $0.url.resolvingSymlinksInPath() }
            == [written.resolvingSymlinksInPath()])
    }

    /// A workflow's Agents sit one directory further down again, so the walk recurses. One level
    /// exactly — the depth the roster's own sweep takes — would find the fan-out and miss these.
    @Test
    func `an Agent a workflow ran is found in the directory below`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "flat")
        try fixture.write(agent: "nested", workflow: "wf_1")

        #expect(SubagentTranscripts.beside(fixture.parentURL).map(\.agentID).sorted()
            == ["flat", "nested"])
    }

    /// The ordinary case, and it must not read as a failure: most Sessions delegate nothing, so the
    /// directory the walk is pointed at is simply not there.
    @Test
    func `a Session that delegated nothing has no Subagent transcripts`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }

        #expect(SubagentTranscripts.beside(fixture.parentURL).isEmpty)
    }

    /// The host writes more than transcripts under there — `tool-results/` sits in the same tree —
    /// and a file whose name is not one an Agent was written under has no `agentID` to key it by.
    @Test
    func `a file that names no Agent is not a Subagent transcript`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "a1")
        let strayURL = fixture.parentURL.deletingPathExtension()
            .appending(path: "subagents", directoryHint: .isDirectory)
            .appending(path: "notes.jsonl")
        try Data().write(to: strayURL)

        #expect(SubagentTranscripts.beside(fixture.parentURL).map(\.agentID) == ["a1"])
    }
}
