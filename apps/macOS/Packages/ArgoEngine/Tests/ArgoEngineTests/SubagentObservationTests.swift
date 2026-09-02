@testable import ArgoEngine
import Testing

/// The port the Hub tails a fan-out through: one observation per Subagent file, each read as the
/// subject of its own record rather than as a sidechain of the parent's.
@Suite("Subagent observation")
struct SubagentObservationTests {
    @Test
    func `a Subagent is observed under the id its delegation names`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: subagentID, lines: Fixture.lines("subagentOwn"))

        #expect(Engine().subagents(beside: fixture.parentURL).map(\.agentID) == [subagentID])
    }

    /// The whole point of reading the child's file at all: what the parent's own reading disowns.
    @Test
    func `what comes back is the Subagent's own reading`() async throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: subagentID, lines: Fixture.lines("subagentOwn"))

        let read = try await backfill(of: fixture)

        #expect(read.contains(.turnEnded(.endTurn)))
    }

    /// The ordinary case: most Sessions delegate nothing, so the directory the walk is pointed at
    /// is not there — which is no Subagents rather than a failure.
    @Test
    func `a Session that delegated nothing is observed as no Subagents`() throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }

        #expect(Engine().subagents(beside: fixture.parentURL).isEmpty)
    }

    /// Everything the file already held, which is the first batch a tail yields. The stream stays
    /// open after it — a Subagent's file goes on growing — so the read stops at that batch.
    private func backfill(of fixture: SubagentDirectoryFixture) async throws -> [TranscriptEvent] {
        let engine = Engine()
        let found = try #require(engine.subagents(beside: fixture.parentURL).first)
        for await batch in engine.observeSubagent(found).events {
            return batch
        }
        return []
    }

    private let subagentID = delegatedAgentID
}
