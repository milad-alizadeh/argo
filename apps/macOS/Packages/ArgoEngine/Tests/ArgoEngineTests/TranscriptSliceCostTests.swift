@testable import ArgoEngine
import Foundation
import Testing

/// What LANDING a read costs the main actor, as counts rather than as seconds (ADR-0028 Rule 8).
///
/// `TranscriptReadCostTests` beside this holds what a read costs the file system — how many files
/// are opened and how much of each is read. Neither of those bounds what happens once the bytes
/// arrive: a tail's first batch is everything its file already held, and taking it under one write
/// held the main actor for a span that grew with the file (#1166).
///
/// Two counts hold it, and both are the same claim from opposite sides:
///
/// - no single write takes more of a read than one slice, whatever the file's length; and
/// - the whole read still publishes the roster ONCE, so the reader sees a row that stands and
///   then changes, never a row growing a slice at a time (#1134).
///
/// The seconds behind the count, why the gate is a count rather than the frame budget #1166 asked
/// for, and what the ticket's two seconds turned out to be, are all `PerfBudgets.foldSlice`. They
/// are stated there and nowhere else, so re-recording them is one edit.
@Suite("Transcript slice cost")
struct TranscriptSliceCostTests {
    /// Two sizes, which is Rule 3's shape: the bound is a ceiling on ONE write, so eight times the
    /// file has to read the same. One slice apart would pass with the read taken whole.
    private static let scales = [400, 3200]

    @Test(.timeLimit(.minutes(1)), arguments: Self.scales)
    @MainActor
    func `a whole read is taken in slices, never in one write of the file`(records: Int) async
        throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture, records: records)
        let chosen = try #require(hub.sessions.first?.id)

        await hub.readSelected(sessionID: chosen)
        await hubSettle { hub.session(id: chosen)?.transcriptExtent == .whole }

        // The reading really is longer than one slice, so the ceiling below is a bound the fixture
        // reaches rather than a number it never got near.
        #expect(hub.watch.join.eventsHeld()[chosen] ?? 0 > PerfBudgets.foldSlice)
        #expect(hub.watch.join.largestFold <= PerfBudgets.foldSlice)
        await hub.disconnect()
    }

    /// The slices publish nothing: the row stands on the reading it had until the whole read has
    /// landed, and then changes once. A read that published per slice would draw a row growing in
    /// front of the reader, which is the vanish #1134 refused said the other way round.
    @Test(.timeLimit(.minutes(1)), arguments: Self.scales)
    @MainActor
    func `a whole read publishes the roster once, whatever the file's length`(records: Int) async
        throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture, records: records)
        let chosen = try #require(hub.sessions.first?.id)
        let published = hub.watch.joinRevision

        await hub.readSelected(sessionID: chosen)
        await hubSettle { hub.session(id: chosen)?.transcriptExtent == .whole }

        #expect(hub.watch.joinRevision == published + 1)
        await hub.disconnect()
    }

    /// A Hub on one long transcript, with its sweep settled. One rather than several: what these
    /// two cases count is what ONE read does, and a second tail publishing beside it would be
    /// another write in the same window.
    @MainActor
    private static func connected(
        to fixture: RecordDirectoryFixture,
        records: Int,
    ) async throws
        -> Hub {
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        try fixture.write(FixtureTranscript(
            name: "session-0",
            cwd: projectURL.path,
            fillerRecords: records,
        ))
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))
        await hubSettle { hub.sessions.count == 1 }
        return hub
    }
}
