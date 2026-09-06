@testable import ArgoEngine
import Foundation
import Testing

/// The port the Hub tails a fan-out through: one observation per Subagent file, each read as the
/// subject of its own record rather than as a sidechain of the parent's.
@Suite("Subagent observation")
struct SubagentObservationTests {
    @Test
    func `a Subagent is observed under the id its delegation names`() async throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(agent: subagentID, lines: Fixture.lines("subagentOwn"))

        #expect(await Engine().walked(beside: fixture.parentURL).map(\.agentID) == [subagentID])
    }

    /// What the whole of #1498 rests on: the walk recurses over a tree that grows with accumulated
    /// history, and on the main actor that was seconds of frame time per sweep.
    ///
    /// The claim pinned here is the language rule `Engine.subagents(beside:)` carries the same
    /// annotation for — `@concurrent async` runs on the generic executor whatever its caller is
    /// isolated to. It is not a call into the walk itself: the walk reports nothing about where it
    /// ran, and instrumenting the shipped code to say so would be the only way to ask it directly.
    /// The same bet, spelled the same way, is pinned the same way in `MediaCacheTests`.
    @Test
    @MainActor
    func `a @concurrent async function runs off the main actor`() async {
        #expect(await Self.runsOnTheMainThread() == false)
    }

    /// `pthread_main_np` rather than `Thread.isMainThread`, which Foundation withholds from an
    /// asynchronous context — the exact context the question is about.
    @concurrent private static func runsOnTheMainThread() async -> Bool {
        pthread_main_np() != 0
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
    func `a Session that delegated nothing is observed as no Subagents`() async throws {
        let fixture = try SubagentDirectoryFixture()
        defer { fixture.remove() }

        #expect(await Engine().walked(beside: fixture.parentURL).isEmpty)
    }

    /// Everything the file already held, which is the first batch a tail yields. The stream stays
    /// open after it — a Subagent's file goes on growing — so the read stops at that batch.
    private func backfill(of fixture: SubagentDirectoryFixture) async throws -> [TranscriptEvent] {
        let engine = Engine()
        let found = try #require(await engine.walked(beside: fixture.parentURL).first)
        for await batch in engine.observeSubagent(found).events {
            return batch
        }
        return []
    }

    private let subagentID = delegatedAgentID
}
