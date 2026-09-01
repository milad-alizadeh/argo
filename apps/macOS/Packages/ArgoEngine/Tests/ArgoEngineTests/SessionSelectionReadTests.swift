@testable import ArgoEngine
import Foundation
import Testing

/// What a roster row says before its Session is selected, and what selecting it adds.
///
/// A sweep reads every transcript's two ends (`TranscriptExcerpt`), so a row exists with a hole in
/// the reading behind it. Two things follow, and both are honesty rather than performance: the row
/// must not state a fact its reading could not establish, and the feed must get the whole file the
/// moment somebody opens it.
@Suite("Reading a Session on selection")
struct SessionSelectionReadTests {
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `the row is there before the middle of its record has been read`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture)
        let session = try #require(hub.sessions.first)

        #expect(session.transcriptExtent == .excerpt)
        #expect(said(by: session).contains(closingWords))
        #expect(!said(by: session).contains { $0.hasPrefix("\(fillerPrefix)200") })
        await hub.disconnect()
    }

    /// A total over part of a file is not the total, and a number that is wrong is worse than no
    /// number: the three spend readings degrade DOWN to absent, which every surface already draws
    /// as unread (`CONTEXT.md` Honesty tier).
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a bounded reading states no total it could not add up`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture)
        let excerpted = try #require(hub.sessions.first)
        #expect(excerpted.spentTokens == nil)
        #expect(excerpted.cachedTokens == nil)
        #expect(excerpted.subagentTokens == nil)

        await hub.readSelected(sessionID: excerpted.id)
        await hubSettle { hub.session(id: excerpted.id)?.transcriptExtent == .whole }

        // The fixture prices nothing, so the honest answer stays absent — what changed is that it
        // is now absent because nothing was reported rather than because nothing was read.
        let whole = try #require(hub.session(id: excerpted.id))
        #expect(whole.transcriptExtent == .whole)
        await hub.disconnect()
    }

    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `selecting a Session gives its feed the whole record`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture)
        let chosen = try #require(hub.sessions.first?.id)

        await hub.readSelected(sessionID: chosen)

        await hubSettle {
            Self.middleWasRead(of: chosen, in: hub)
        }
        let session = try #require(hub.session(id: chosen))
        #expect(session.transcriptExtent == .whole)
        // And the row is the same row: selecting reads more of a Session, it does not replace it.
        #expect(hub.sessions.map(\.id).contains(chosen))
        await hub.disconnect()
    }

    /// The row on screen while the drain runs is the STALE one, never an absent one: the roster
    /// keeps what it has published until the new reading settles (`HubJoin.reread`).
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `the row stands while its record is being read again`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture, transcripts: 3)
        let rows = hub.sessions.map(\.id)

        await hub.readSelected(sessionID: rows[1])

        #expect(hub.sessions.map(\.id) == rows)
        await hub.disconnect()
    }

    /// Whether the stretch only a whole reading reaches has landed.
    @MainActor
    private static func middleWasRead(of sessionID: String, in hub: Hub) -> Bool {
        guard let session = hub.session(id: sessionID) else { return false }
        return said(by: session).contains { $0.hasPrefix("\(fillerPrefix)200") }
    }

    @MainActor
    private static func connected(
        to fixture: RecordDirectoryFixture,
        transcripts: Int = 1,
    ) async throws
        -> Hub {
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        for index in 0 ..< transcripts {
            try fixture.write(FixtureTranscript(
                name: "session-\(index)",
                cwd: projectURL.path,
                modifiedAgo: TimeInterval(transcripts - index),
                fillerRecords: 400,
            ))
        }
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))
        await hubSettle { hub.sessions.count == transcripts }
        return hub
    }
}
