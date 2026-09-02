import AppKit
import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The three things a surface can be looking at when it has no pixels in hand (#989).
///
/// The pixels are read where they are drawn, so "not yet" became a state the cockpit has to draw.
/// It must not be drawn as "there was never a picture", and a picture that has GONE must not be
/// drawn as either. The byte runs are 1400-wide and up, a range no other suite reaches into: two
/// suites sharing a run would share `MediaCache.shared`.
@Suite("Waiting for a picture")
@MainActor
struct MediaWaitTests {
    private static let plate = MediaBox.plate(CGSize(width: 168, height: 112))

    @Test
    func `a picture nothing has decoded yet is pending, and never an absence`() throws {
        let media = try MediaFixture.media(width: 1400, height: 900)

        let showing = MediaShowing.atOnce(media)

        #expect(showing.picture == nil)
        #expect(showing.isPending)
        // The claim survives the wait: this is the record's own capture whether or not the pixels
        // have arrived, so the caption may not drop "as the agent saw it" and put it back.
        #expect(showing.provenance == .captured)
    }

    @Test
    func `a record that kept no picture is not pending`() {
        let showing = MediaShowing.atOnce(
            MediaEvidence(tier: .direct, mediaType: "image/png", bytes: nil),
        )

        #expect(!showing.isPending)
        #expect(showing.provenance == .absent)
        #expect(showing.provenance.instead == MediaProvenance.absence)
    }

    @Test
    func `an addressed picture is read off the file and decoded`() async throws {
        let base64 = try MediaFixture.base64(width: 1401, height: 901)
        let file = try ScratchTranscript(carrying: base64)
        let media = MediaEvidence(
            tier: .direct,
            mediaType: "image/png",
            bytes: MediaBytes(address: .run(transcript: file.path, at: file.at), base64: base64),
        )

        let showing = try #require(await MediaShowing.decoded(media, drawnIn: Self.plate))

        #expect(showing.picture?.spokenSize == "1401 × 901")
        #expect(showing.provenance == .captured)
    }

    @Test
    func `a picture whose file went away says so, and not that there was none`() async throws {
        let base64 = try MediaFixture.base64(width: 1402, height: 902)
        let media = MediaEvidence(
            tier: .direct,
            mediaType: "image/png",
            bytes: MediaBytes(
                address: .run(transcript: "/var/empty/argo-no-such-transcript.jsonl", at: 0),
                base64: base64,
            ),
        )

        // Pending until the read has been tried, and settled the moment it fails: a capture that
        // was deleted must not wait forever on a plate.
        #expect(MediaShowing.atOnce(media).isPending)
        let showing = try #require(await MediaShowing.decoded(media, drawnIn: Self.plate))

        #expect(!showing.isPending)
        #expect(showing.provenance == .unreadable)
        #expect(showing.provenance.instead == MediaProvenance.gone)
        #expect(showing.provenance.instead != MediaProvenance.absence)
    }

    /// A capture cut short by a dying writer passes the signature check and then decodes to
    /// nothing — the one run where the promise is broken by the file itself rather than by the
    /// file going away.
    @Test
    func `a picture cut short after its header settles as gone rather than as an absence`(
    ) async throws {
        let media = try MediaFixture.truncatedMedia(width: 1404, height: 904)

        #expect(MediaShowing.atOnce(media).isPending)
        let showing = try #require(await MediaShowing.decoded(media, drawnIn: Self.plate))

        #expect(showing.picture == nil)
        #expect(!showing.isPending)
        #expect(showing.provenance == .unreadable)
        #expect(showing.provenance.instead == MediaProvenance.gone)
    }

    @Test
    func `bytes that were never a picture stay an absence after the read`() async {
        let media = MediaEvidence(
            tier: .direct,
            mediaType: "image/png",
            bytes: .held("bm90IGEgcG5nIGF0IGFsbCwgbm90IGV2ZW4gY2xvc2U="),
        )

        // Nothing is left pending, so nothing has to be settled: `atOnce` already said absent, and
        // the read has no news that would make it "gone".
        #expect(!MediaShowing.atOnce(media).isPending)
        #expect(await MediaShowing.decoded(media, drawnIn: Self.plate) == nil)
    }
}

/// A file with one base64 run inside it, at a known offset — the shape a transcript addresses a
/// picture in, without a transcript's own JSON around it.
private struct ScratchTranscript: ~Copyable {
    let path: String
    let at: Int

    init(carrying base64: String) throws {
        let prologue = #"{"type":"user","message":{"content":[{"data":""#
        let url = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("argo-shot-\(UUID().uuidString).jsonl")
        try (prologue + base64 + "\"}]}}\n").write(to: url, atomically: true, encoding: .utf8)
        self.path = url.path
        self.at = prologue.utf8.count
    }

    deinit { try? FileManager.default.removeItem(atPath: path) }
}
