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

        let found = try #require(SubagentTranscripts.beside(fixture.parentURL, unchangedSince: nil))
            .transcripts

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

        #expect(SubagentTranscripts.beside(fixture.parentURL, unchangedSince: nil)?
            .transcripts.map(\.agentID).sorted() == ["flat", "nested"])
    }

    /// The ordinary case, and it must not read as a failure: most Sessions delegate nothing, so the
    /// directory the walk is pointed at is simply not there.
    @Test
    func `a Session that delegated nothing has no Subagent transcripts`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }

        #expect(SubagentTranscripts.beside(fixture.parentURL, unchangedSince: nil)?
            .transcripts.isEmpty == true)
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

        #expect(SubagentTranscripts.beside(fixture.parentURL, unchangedSince: nil)?
            .transcripts.map(\.agentID) == ["a1"])
    }

    /// The skip this walk is worth having. A tree nobody wrote to since the last walk cannot have
    /// gained a Subagent, so the second call reads directory dates and stops there.
    @Test
    func `a tree nothing was written to is not walked again`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "a1")

        let walked = try #require(SubagentTranscripts.beside(
            fixture.parentURL,
            unchangedSince: nil,
        ))

        #expect(SubagentTranscripts.beside(fixture.parentURL, unchangedSince: walked.stamp) == nil)
    }

    /// The case a stamp on the tree's ROOT alone would lose: a second Agent handed to a workflow
    /// lands in a directory that already existed, so only that directory's own date moves. Every
    /// directory is stamped for exactly this.
    @Test
    func `an Agent written into a directory below invalidates the stamp`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "first", workflow: "wf_1")
        let walked = try #require(SubagentTranscripts.beside(
            fixture.parentURL,
            unchangedSince: nil,
        ))

        try fixture.write(agent: "second", workflow: "wf_1")

        #expect(SubagentTranscripts.beside(fixture.parentURL, unchangedSince: walked.stamp)?
            .transcripts.map(\.agentID).sorted() == ["first", "second"])
    }

    /// `tool-results/` is the bulk of the file count and holds nothing this walk keeps, so it is
    /// never descended into — and never stamped, which is what keeps a tool result written between
    /// two sweeps from costing a walk of the whole tree.
    @Test
    func `a tool result is neither walked nor stamped`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: "a1")
        try fixture.writeToolResult(named: "first")
        let walked = try #require(SubagentTranscripts.beside(
            fixture.parentURL,
            unchangedSince: nil,
        ))

        try fixture.writeToolResult(named: "second")

        #expect(walked.stamp.directoryDates.keys.allSatisfy { !$0.contains("tool-results") })
        #expect(SubagentTranscripts.beside(fixture.parentURL, unchangedSince: walked.stamp) == nil)
    }
}
