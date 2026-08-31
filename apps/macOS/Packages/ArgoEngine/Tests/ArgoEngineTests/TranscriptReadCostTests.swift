@testable import ArgoEngine
import Foundation
import Testing

/// What reading the working set COSTS, as counts rather than as seconds (ADR-0028 Rule 8).
///
/// This is the gate that lets ADR-0008's window be a week. The window was a day because the launch
/// read every transcript it admitted, and reading a week of them whole is 458 MB on the machine
/// this
/// was measured on. The constraint the narrow window was protecting — never the full history at
/// launch — is held here instead, by two counts and a byte bound:
///
/// - a launch sweep opens NOTHING whole, however many transcripts the week admits;
/// - one bounded open reads at most the file's two ends, whatever the file's length; and
/// - selecting one Session opens its file exactly ONCE, however many times it is clicked and
///   however many other Sessions are visited in between, up to `WholeReadings.capacity`.
///
/// Every figure is a count of opens or of bytes asked of the file system, so none of them moves
/// with
/// what else is running on the box. They are read off the watch's own tally rather than a
/// process-wide one, so a suite running beside this cannot inflate them.
@Suite("Transcript read cost")
struct TranscriptReadCostTests {
    /// Long enough that its two ends do not meet, so a bounded reading and a whole one are
    /// different
    /// values.
    private static let longEnough = 400

    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a launch sweep opens no transcript whole`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture, transcripts: 3)

        #expect(hub.watch.reads == TranscriptWatchReads(whole: 0, excerpt: 3))
        await hub.disconnect()
    }

    /// The bound the sweep's bytes come from: whatever a transcript's length, one bounded open
    /// reads
    /// its two ends and the partial record the second of them begins on. Everything else about a
    /// sweep's cost is that figure times the count above.
    @Test
    func `a bounded open reads the two ends and nothing else`() throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let url = try fixture.write(FixtureTranscript(
            cwd: fixture.path("checkout"),
            fillerRecords: 4000,
        ))
        let onDisk = try #require(try url.resourceValues(forKeys: [.fileSizeKey]).fileSize)
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        let excerpt = try #require(TranscriptExcerpt(reading: handle))

        #expect(onDisk > TranscriptExcerpt.sideByteLimit * 8)
        #expect(excerpt.bytesRead <= TranscriptExcerpt.sideByteLimit * 2)
    }

    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `selecting a Session opens its file once, however often it is clicked`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture, transcripts: 2)
        let chosen = try #require(hub.sessions.first?.id)

        for _ in 0 ..< 4 {
            await hub.readSelected(sessionID: chosen)
        }

        #expect(hub.watch.reads == TranscriptWatchReads(whole: 1, excerpt: 2))
        await hub.disconnect()
    }

    /// The claim the reader will notice: browsing away and back is a lookup. Held for
    /// `WholeReadings.capacity` Sessions, which is why nineteen others in between still cost
    /// nothing.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `coming back to a Session already read opens nothing`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture, transcripts: 3)
        let rows = hub.sessions.map(\.id)

        for id in rows + [rows[0], rows[1], rows[0]] {
            await hub.readSelected(sessionID: id)
        }

        #expect(hub.watch.reads == TranscriptWatchReads(whole: 3, excerpt: 3))
        await hub.disconnect()
    }

    /// And the ceiling, which is what keeps "cached" from meaning "unbounded". One past capacity
    /// evicts the OLDEST reading — never the whole table (ADR-0028 Rule 4) — so coming back to that
    /// one, and only that one, drains again.
    @Test(.timeLimit(.minutes(2)))
    @MainActor
    func `past the ceiling the oldest reading is the one that drains again`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let held = WholeReadings.capacity
        let hub = try await Self.connected(to: fixture, transcripts: held + 1, fillerRecords: 0)
        let rows = hub.sessions.map(\.id)

        for id in rows {
            await hub.readSelected(sessionID: id)
        }
        // The newest of them is still held; the first one was evicted to make room for it.
        await hub.readSelected(sessionID: rows[held])
        #expect(hub.watch.reads.whole == held + 1)

        await hub.readSelected(sessionID: rows[0])

        #expect(hub.watch.reads.whole == held + 2)
        await hub.disconnect()
    }

    /// A Hub pointed at a record directory of long transcripts, with its sweep settled.
    @MainActor
    private static func connected(
        to fixture: RecordDirectoryFixture,
        transcripts: Int,
        fillerRecords: Int = longEnough,
    ) async throws
        -> Hub {
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        for index in 0 ..< transcripts {
            try fixture.write(FixtureTranscript(
                name: "session-\(index)",
                cwd: projectURL.path,
                modifiedAgo: TimeInterval(transcripts - index),
                fillerRecords: fillerRecords,
            ))
        }
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))
        await hubSettle { hub.sessions.count == transcripts }
        return hub
    }
}
