@testable import ArgoEngine
import Foundation
import Testing

/// The bounded read a launch sweep takes: a transcript's two ends, the seam between them, and the
/// tail that carries on from there (`TranscriptExcerpt`).
@Suite("Transcript excerpt")
struct TranscriptExcerptTests {
    @Test
    func `a long transcript is read at both ends and not in the middle`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let url = try fixture.write(FixtureTranscript(
            cwd: fixture.path("checkout"),
            fillerRecords: 400,
        ))

        let events = try await Self.excerptEvents(of: url)

        let read = Self.fillerIndices(in: events)
        #expect(events.contains(.cwd(fixture.path("checkout"))))
        #expect(events.contains(.message(markdown: closingWords)))
        // Both ends, and a hole where the middle was: the first records and the last are there, and
        // the ones in between were never opened.
        #expect(read.contains(0))
        #expect(read.contains(399))
        #expect(!read.contains(200))
        #expect(read.count < 400)
    }

    /// The whole point of the marker: the events after it are later than the events before it, with
    /// a stretch of the record missing in between (`CONTEXT.md` Honesty tier).
    @Test
    func `the seam is marked where the reading skipped`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let url = try fixture.write(FixtureTranscript(
            cwd: fixture.path("checkout"),
            fillerRecords: 400,
        ))

        let events = try await Self.excerptEvents(of: url)
        let seam = try #require(events.firstIndex(of: .excerpted))

        #expect(events.prefix(seam).contains(.cwd(fixture.path("checkout"))))
        #expect(events.dropFirst(seam).contains(.message(markdown: closingWords)))
    }

    @Test
    func `a transcript whose two ends meet is read whole and marked nothing`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let url = try fixture.write(FixtureTranscript(
            cwd: fixture.path("checkout"),
            fillerRecords: 4,
        ))

        let events = try await Self.excerptEvents(of: url)

        #expect(!events.contains(.excerpted))
        #expect(Self.fillerIndices(in: events) == [0, 1, 2, 3])
    }

    /// A bounded opening read is still a LIVE reading: the cursor is left at the end of the file,
    /// so what an agent appends next arrives without the middle being read to reach it.
    @Test(.timeLimit(.minutes(1)))
    func `what is appended after the excerpt still arrives`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let url = try fixture.write(FixtureTranscript(
            cwd: fixture.path("checkout"),
            fillerRecords: 400,
        ))
        let lines = transcriptLines(at: url, excerptSideLimit: TranscriptExcerpt.sideByteLimit)
        var reads = lines.makeAsyncIterator()
        _ = await reads.next()

        try Self.append(
            "{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"Next\"}}\n",
            to: url,
        )

        let appended = await Self.nextNonEmpty(&reads)
        #expect(appended?.count == 1)
        #expect(appended?.first?.text.contains("Next") == true)
        // The file's own offset, not the batch's: an offset is what addresses a picture
        // (`MediaLocation`), so a read that began mid-file must still count from the start of it.
        let size = try #require(try url.resourceValues(forKeys: [.fileSizeKey]).fileSize)
        let offset = try #require(appended?.first?.byteOffset)
        #expect(offset > TranscriptExcerpt.sideByteLimit)
        #expect(offset < size)
    }

    /// Which filler records the reading holds, by their number in the file.
    private static func fillerIndices(in events: [TranscriptEvent]) -> [Int] {
        events.compactMap { event in
            guard case let .message(markdown) = event, markdown.hasPrefix(fillerPrefix)
            else { return nil }
            return Int(markdown.dropFirst(fillerPrefix.count).prefix { $0.isNumber })
        }
    }

    private static func excerptEvents(of url: URL) async throws -> [TranscriptEvent] {
        var reads = transcriptExcerptEvents(at: url).makeAsyncIterator()
        return try #require(await reads.next())
    }

    private static func nextNonEmpty(
        _ reads: inout AsyncStream<[TranscriptLine]>.Iterator,
    ) async
        -> [TranscriptLine]? {
        while let batch = await reads.next() {
            if !batch.isEmpty {
                return batch
            }
        }
        return nil
    }

    private static func append(_ line: String, to url: URL) throws {
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: Data(line.utf8))
    }
}
