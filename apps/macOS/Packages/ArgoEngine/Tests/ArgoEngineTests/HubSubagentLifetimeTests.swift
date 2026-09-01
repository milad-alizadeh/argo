@testable import ArgoEngine
import Foundation
import Testing

/// How long a Subagent's reading and its descriptors last, which are two different answers (#858).
///
/// A transcript that ages out of the working set keeps its ROW, so it keeps its children's
/// readings; what it gives up is the descriptors. One that has GONE from disk keeps neither. The
/// two are easy to conflate in the code that implements them and impossible to tell apart from the
/// roster, which is why they are stated here side by side.
@Suite("Hub subagent lifetime")
struct HubSubagentLifetimeTests {
    private let subagentID = delegatedAgentID

    /// The tails are the bounded resource, so a Session dropped from the working set releases its
    /// children's descriptors along with its own.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Session that stops being tailed stops tailing its Subagents`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        let url = try writeSubagent(
            beside: parent,
            agent: subagentID,
            lines: Fixture.lines("subagentOwn"),
        )
        await hub.refreshWorkingSet()
        await hubSettle { hub.subagentReading(of: subagentID) != nil }
        #expect(openDescriptorCount(for: url) > 0)

        await hub.disconnect()

        await hubSettle { openDescriptorCount(for: url) == 0 }
        #expect(openDescriptorCount(for: url) == 0)
    }

    /// A transcript that ages out keeps its row and loses its tail, so the sweep after it must not
    /// read its children back in — that would put back the descriptors the pause just released,
    /// once per sweep for as long as the row stood.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an aged-out Session does not get its Subagent tails back`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        let url = try writeSubagent(
            beside: parent,
            agent: subagentID,
            lines: Fixture.lines("subagentOwn"),
        )
        await hub.refreshWorkingSet()
        await hubSettle { hub.subagentReading(of: subagentID) != nil }

        try fixture.age(parent, by: SessionDiscovery.workingSetWindow * 2)
        await hub.refreshWorkingSet()
        await hub.refreshWorkingSet()

        #expect(hub.observations.map(\.state) == [.stopped])
        #expect(openDescriptorCount(for: url) == 0)
        await hub.disconnect()
    }

    /// A transcript that ages out keeps its ROW, so it keeps its children's readings too — the
    /// descriptors are what is bounded, not the reading. The rail goes on offering the chip.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an aged-out Session keeps its Subagents' readings`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        try writeSubagent(beside: parent, agent: subagentID, lines: Fixture.lines("subagentOwn"))
        await hub.refreshWorkingSet()
        await hubSettle { hub.subagentReading(of: subagentID) != nil }

        try fixture.age(parent, by: SessionDiscovery.workingSetWindow * 2)
        await hub.refreshWorkingSet()
        await hub.refreshWorkingSet()

        #expect(hub.observations.map(\.state) == [.stopped])
        #expect(hub.subagentReading(of: subagentID) != nil)
        await hub.disconnect()
    }

    /// And a transcript GONE from disk loses them, the way it loses its row — including after a
    /// pause, which is the case the tail table has to survive: cleared when the tail stopped, the
    /// drop that follows would have nothing left to name and would free nothing at all.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Session whose file is gone loses its Subagents' readings`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        try writeSubagent(beside: parent, agent: subagentID, lines: Fixture.lines("subagentOwn"))
        await hub.refreshWorkingSet()
        await hubSettle { hub.subagentReading(of: subagentID) != nil }
        try fixture.age(parent, by: SessionDiscovery.workingSetWindow * 2)
        await hub.refreshWorkingSet()

        try FileManager.default.removeItem(at: parent)
        await hub.refreshWorkingSet()

        await hubSettle { hub.subagentReading(of: subagentID) == nil }
        #expect(hub.sessions.isEmpty)
        await hub.disconnect()
    }

    /// A Project nobody is pointed at has no Subagents, the same way it has no branches.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `letting the Project go forgets every reading`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await connectedSubagentHub(fixture)
        let parent = try #require(hub.sessions.first?.sourceURL)
        try writeSubagent(beside: parent, agent: subagentID, lines: Fixture.lines("subagentOwn"))
        await hub.refreshWorkingSet()
        await hubSettle { hub.subagentReading(of: subagentID) != nil }

        await hub.disconnect()

        #expect(hub.subagentReading(of: subagentID) == nil)
    }
}
