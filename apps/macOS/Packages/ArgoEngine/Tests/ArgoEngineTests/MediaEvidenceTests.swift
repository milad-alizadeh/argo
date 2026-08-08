@testable import ArgoEngine
import Testing

// The whole tier ladder a picture can arrive on, in the order the reading prefers: the transcript's
// own embedded bytes DIRECT, a re-read of the path DERIVED, and no bytes at all as an absence a row
// can state. Asserted in one suite because the reading decides them in one place, and read through
// the reader because the gates that decide WHETHER a path is re-read are half of that decision.

@Suite("Media evidence")
struct MediaEvidenceTests {
    /// The picture one call showed, or a recorded failure naming what the row got instead.
    private func media(
        _ fixture: String,
        _ id: String,
        readImage: @escaping ImageReader = noImageReader,
    ) async throws
        -> MediaEvidence? {
        let outcomes = try await Fixture.events(fixture, readImage: readImage).outcomes()
        let result = try #require(outcomes[id]?.result)
        guard case let .media(media) = result else {
            Issue.record("\(id) was read as \(result), not as a picture")
            return nil
        }
        return media
    }

    @Test
    func `Embedded image bytes are read, and are DIRECT`() async throws {
        let media = try #require(try await media("media", "shot-1"))

        #expect(media.tier == .direct)
        #expect(media.mediaType == "image/png")
        #expect(media.bytes == "BEFORE-BYTES")
    }

    @Test
    func `Two renders of ONE path keep their own bytes, in order`() async throws {
        // The whole reason embedded bytes outrank a disk read: both calls name `/tmp/header.png`,
        // and a path-first reading would show the newest picture under both rows.
        let before = try #require(try await media("media", "shot-1"))
        let after = try #require(try await media("media", "shot-2"))

        #expect(before.bytes == "BEFORE-BYTES")
        #expect(after.bytes == "AFTER-BYTES")
    }

    @Test
    func `A record that embedded nothing falls back to the file, at the LOWER tier`() async throws {
        let media = try #require(
            try await media("mediaTiers", "disk-1", readImage: { _ in "FROM-DISK" }),
        )

        #expect(media.tier == .derived)
        #expect(media.mediaType == "image/png")
        #expect(media.bytes == "FROM-DISK")
    }

    @Test
    func `A picture that can no longer be read is a row with no bytes, not silence`() async throws {
        let media = try #require(try await media("mediaTiers", "disk-1"))

        #expect(media.tier == .derived)
        #expect(media.bytes == nil)
    }

    @Test
    func `An embedded result whose bytes were stripped keeps its DIRECT tier`() async throws {
        // The record named an image and carried no pixels for it. The tier is a claim about WHERE
        // the fact came from, so it stays `direct` — a row with nothing to show says so instead.
        let media = try #require(try await media("mediaTiers", "stripped-1"))

        #expect(media.tier == .direct)
        #expect(media.mediaType == "image/png")
        #expect(media.bytes == nil)
    }

    @Test
    func `A failed image read shows the error, never a picture of the file as it stands now`(
    ) async throws {
        let outcomes = try await Fixture.events("media", readImage: { _ in "FROM-DISK" }).outcomes()
        let failed = try #require(outcomes["shot-3"])

        #expect(failed.status == .failed)
        guard case let .output(output) = try #require(failed.result) else {
            Issue.record("a failed read carries what went wrong")
            return
        }
        #expect(output.text == "File does not exist: /tmp/gone.png")
    }

    @Test
    func `An SVG handed back as source stays text, and is not rendered as a picture`() async throws {
        let outcomes = try await Fixture.events("media", readImage: { _ in "FROM-DISK" }).outcomes()
        // `.svg` is in the disk-fallback table, so only the "result carried text of its own" gate
        // keeps this a read of source rather than a render of the file. It is kept as TEXT — what
        // the agent read was markup, and a panel drawing it as a picture would be showing something
        // the agent never saw.
        guard case let .output(output) = try #require(outcomes["vector-1"]).result else {
            Issue.record("source handed back as text stays text")
            return
        }

        #expect(output.text.hasPrefix("<svg"))
    }
}
