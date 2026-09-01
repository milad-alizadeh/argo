@testable import ArgoEngine
import Foundation
import Testing

/// What the retained event streams hold for the pictures they read (#989).
///
/// The gate is a CENSUS and not a footprint (see `MediaFootprint`): a whole working set's pictures
/// are addressed, so what the streams retain is a name and a signature per picture and does not
/// grow with the picture at all. The pixels — the one thing that does scale — are held by
/// `MediaCache` in `ArgoUI`, under its own ceiling and its own gate.
@Suite("Media memory cost")
struct MediaMemoryCostTests {
    /// The bound: everything a whole OBSERVED working set retains for its pictures is a rounding
    /// error against what ONE of its Sessions would weigh held. Stated as a ratio rather than in
    /// bytes, so it survives a change of fixture size (ADR-0028 Rule 7).
    ///
    /// A hundredfold, against a measured 2 300-fold: eight sessions of six 200 KB captures weigh
    /// 9.6 MB of base64, of which one session is 1.2 MB, and the whole set retains 5 KB.
    private static let selectedSessionShare = 100.0

    @Test
    func `an observed working set retains no picture, whatever its pictures weigh`() async throws {
        let fixture = try MediaTranscriptFixture(
            sessions: 8,
            picturesEach: 6,
            kilobytesEach: 200,
        )
        let read = try await backfills(of: fixture.urls)
        let retained = read.reduce(0) { $0 + retainedMediaBytes(in: $1) }
        let payload = read.reduce(0) { $0 + mediaPayloadBytes(in: $1) }
        let selected = payload / read.count

        #expect(read.flatMap(mediaEvidence).count == fixture.pictures)
        #expect(payload > 0)
        #expect(Double(retained) < Double(selected) / Self.selectedSessionShare)
    }

    /// The same claim from the other side: what is retained is per PICTURE and never per pixel, so
    /// doubling every capture's size leaves the census where it was. A stream that went back to
    /// holding the bytes fails this at the ratio of the two sizes.
    @Test
    func `retained bytes do not follow the size of the pictures`() async throws {
        let small = try MediaTranscriptFixture(sessions: 3, picturesEach: 4, kilobytesEach: 100)
        let large = try MediaTranscriptFixture(sessions: 3, picturesEach: 4, kilobytesEach: 400)
        let thin = try await backfills(of: small.urls).reduce(0) { $0 + retainedMediaBytes(in: $1) }
        let fat = try await backfills(of: large.urls).reduce(0) { $0 + retainedMediaBytes(in: $1) }

        // Not equality: the two fixtures' own paths differ in length by a character or two.
        #expect(Double(fat) / Double(thin) < 1.1)
    }

    /// The address is only worth anything if the picture comes BACK. Byte-for-byte, off the file,
    /// through the same call the cockpit's decode makes.
    @Test
    func `an addressed picture reads back exactly the bytes the record carried`() async throws {
        let fixture = try MediaTranscriptFixture(sessions: 1, picturesEach: 3, kilobytesEach: 40)
        let read = try await backfills(of: fixture.urls)
        let pictures = read.flatMap(mediaEvidence)

        #expect(pictures.count == 3)
        for picture in pictures {
            let bytes = try #require(picture.bytes)
            guard case .run = bytes.address else {
                Issue.record("a tail addresses its pictures; \(bytes.address) holds them")
                continue
            }
            let data = try #require(mediaData(at: bytes))
            #expect(data.base64EncodedString().utf8.count == bytes.count)
            #expect(data.prefix(4) == Data([0x89, 0x50, 0x4E, 0x47]))
        }
    }

    /// Two pasted pictures of one window size share their first 24 bytes — signature, IHDR tag and
    /// dimensions — so a record carrying both is the case that told a run's head from a run. Two of
    /// 224 real pictures came back as the wrong picture's bytes before the whole run was the
    /// needle.
    @Test
    func `two pictures alike at the head are addressed apart`() async throws {
        let first = MediaTranscriptFixture.base64(kilobytes: 8, salt: "one")
        let second = MediaTranscriptFixture.base64(kilobytes: 12, salt: "two")
        let file = try PromptFixture(pasting: [first, second])
        let read = try await backfills(of: [file.url])
        let pasted = read.flatMap(mediaEvidence)

        #expect(pasted.count == 2)
        #expect(String(first.prefix(MediaBytes.signatureLength))
            == String(second.prefix(MediaBytes.signatureLength)))
        let resolved = pasted.compactMap { $0.bytes.flatMap(mediaData) }
        #expect(resolved == [first, second].compactMap { Data(base64Encoded: $0) })
    }

    /// A transcript rewritten under a held address answers with nothing rather than with somebody
    /// else's bytes — the signature is checked against what the offset now holds.
    @Test
    func `an address whose file moved under it resolves to nothing`() async throws {
        let fixture = try MediaTranscriptFixture(sessions: 1, picturesEach: 1, kilobytesEach: 20)
        let url = try #require(fixture.urls.first)
        let picture = try #require(try await backfills(of: [url]).flatMap(mediaEvidence).first)
        let bytes = try #require(picture.bytes)

        try "{}\n".write(to: url, atomically: true, encoding: .utf8)

        #expect(mediaData(at: bytes) == nil)
    }

    /// The real record directory, read-only, when `ARGO_REAL_TRANSCRIPTS` names it. Reported and
    /// never asserted on its figures: those went into the commit message, and CI has no such
    /// folder. What it DOES assert is that every address off a real tail resolves.
    @Test
    func `the real working set's retained media, reported`() async throws {
        guard let folder = ProcessInfo.processInfo.environment["ARGO_REAL_TRANSCRIPTS"]
        else { return }
        let urls = try biggestTranscripts(in: URL(fileURLWithPath: folder), count: 6)
        let read = try await measured(urls)
        print(read.report(of: urls.map(sizeOnDisk).reduce(0, +)))
        // Every picture, off the real files, at the offsets a real tail recorded: an address that
        // does not resolve is a picture the cockpit would draw as gone.
        #expect(read.readable == read.addressed)
        #expect(read.events > 0)
    }

    /// One read of the whole set, with the memory taken around it. Nothing else happens between
    /// the two readings: a resolution pass or a census inside them would be measuring itself.
    private func measured(_ urls: [URL]) async throws -> MediaReading {
        let before = (heap: liveHeapBytes(), footprint: settledFootprint())
        let started = processCPUSeconds()
        var read = try await backfills(of: urls)
        let cpu = processCPUSeconds() - started
        let held = (heap: liveHeapBytes(), footprint: settledFootprint())
        var reading = MediaReading(read, heldHeap: held.heap - before.heap, cpu: cpu)
        read = []
        reading.releasedHeap = liveHeapBytes() - before.heap
        reading.peakFootprint = held.footprint - before.footprint
        reading.resolve()
        return reading
    }

    private func biggestTranscripts(in folder: URL, count: Int) throws -> [URL] {
        try FileManager.default
            .contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey])
            .filter { $0.pathExtension == "jsonl" }
            .sorted { sizeOnDisk($0) > sizeOnDisk($1) }
            .prefix(count)
            .map(\.self)
    }

    private func sizeOnDisk(_ url: URL) -> Int {
        (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    }

    /// The first batch of each transcript's own stream: everything the file already held, read the
    /// way the Hub reads it — through `transcriptEvents`, with a real disk under the fallback.
    private func backfills(of urls: [URL]) async throws -> [[TranscriptEvent]] {
        var read: [[TranscriptEvent]] = []
        for url in urls {
            for await events in transcriptEvents(at: url, readImage: diskImageReader) {
                read.append(events)
                break
            }
        }
        return read
    }
}
