@testable import ArgoEngine
import Foundation
import Testing

/// A fan-out read off disk: the Subagent files beside a Session's own record, tailed as they appear
/// and published beside the roster, which is where the rail asks for one (#858).
@Suite("Hub subagents")
struct HubSubagentTests {
    private let subagentID = delegatedAgentID

    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Subagent beside a Session reaches that Session's row`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)

        try writeSubagent(beside: parent, agent: subagentID, lines: Fixture.lines("subagentOwn"))
        await hub.refreshWorkingSet()

        await hubSettle { hub.subagentReading(of: subagentID) != nil }
        #expect(hub.subagentReading(of: subagentID)?.contains(.turnEnded(.endTurn)) == true)
        await hub.disconnect()
    }

    /// A file written after the Session was opened, which is every file a live fan-out writes: the
    /// parent hands the work over and the child's record appears a moment later.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Subagent that appears after the Session was opened is picked up`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        #expect(hub.subagentReading(of: "later") == nil)

        try writeSubagent(beside: parent, agent: "later", lines: Fixture.lines("subagentOwn"))
        await hub.refreshWorkingSet()

        await hubSettle { hub.subagentReading(of: "later") != nil }
        await hub.disconnect()
    }

    /// The ordinary case, and the one the rail draws nothing for: the Session delegated nothing, so
    /// there is no directory beside its record at all.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Session that delegated nothing carries no Subagent reading`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)

        await hub.refreshWorkingSet()

        #expect(hub.subagentReading(of: subagentID) == nil)
        await hub.disconnect()
    }

    /// Growth is what a tail is FOR: a Subagent's file goes on being appended to after the parent
    /// has fallen quiet, and a one-shot read would freeze its reading at whatever had landed.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Subagent file that grows keeps growing on the row`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        let lines = try Fixture.lines("subagentOwn").filter { !$0.isEmpty }
        let url = try writeSubagent(beside: parent, agent: subagentID, lines: [lines[0], ""])
        await hub.refreshWorkingSet()
        await hubSettle { hub.subagentReading(of: subagentID) != nil }

        // The trailing newline is what makes the last record a COMPLETE line: a tail carries an
        // unterminated one as a record still being written, which is exactly what it is.
        try Data((lines + [""]).joined(separator: "\n").utf8).write(to: url)

        await hubSettle {
            hub.subagentReading(of: subagentID)?.contains(.turnEnded(.endTurn)) == true
        }
        await hub.disconnect()
    }

    /// A workflow's Agents sit one directory further down again, and the whole leg has to reach
    /// them: the walk recurses, but so must the tail that reads what it found.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an Agent a workflow ran is read like any other`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)

        try writeSubagent(
            beside: parent,
            agent: "nested",
            lines: Fixture.lines("subagentOwn"),
            workflow: "wf_1",
        )
        await hub.refreshWorkingSet()

        await hubSettle { hub.subagentReading(of: "nested") != nil }
        #expect(hub.subagentReading(of: "nested")?.contains(.turnEnded(.endTurn)) == true)
        await hub.disconnect()
    }

    /// The regression the reader's four guards exist for, stated at the top: a child's file is read
    /// as its OWN subject, so its spend must not also land on the parent it was delegated by.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `reading a Subagent does not move the parent's roll-up`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        // A parent that actually delegated, so the roll-up under test is a number rather than the
        // absence every un-priced transcript would satisfy.
        try append(Fixture.lines("delegationAgent"), to: parent)
        await hubSettle { hub.sessions.first?.subagentTokens != nil }
        let before = try #require(hub.sessions.first)

        try writeSubagent(beside: parent, agent: subagentID, lines: Fixture.lines("subagentOwn"))
        await hub.refreshWorkingSet()
        await hubSettle { hub.subagentReading(of: subagentID) != nil }

        let after = try #require(hub.sessions.first)
        #expect(after.subagentTokens != nil)
        #expect(after.spentTokens == before.spentTokens)
        #expect(after.subagentTokens == before.subagentTokens)
        #expect(after.contextTokens == before.contextTokens)
        // The events the feed draws are the parent's own, and a child's records are not among them.
        #expect(after.events == before.events)
        await hub.disconnect()
    }

    /// Add records to a transcript the Hub is already tailing, terminated — an unterminated last
    /// line is a record still being written, and the tail carries it rather than reading it.
    private func append(_ lines: [String], to url: URL) throws {
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        let written = lines.filter { !$0.isEmpty }.joined(separator: "\n")
        try handle.write(contentsOf: Data("\(written)\n".utf8))
    }
}
