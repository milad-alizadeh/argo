import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What ONE shot inside a gallery says about itself: the provenance it reads off the evidence, the
/// frame that provenance is drawn in, whether there is a picture to open, and the two names it
/// carries — the file it is captioned by and the path it opens onto.
///
/// Which runs FOLD into a gallery at all is `FeedGalleryTests`.
@Suite("Feed shot reading")
struct FeedShotReadingTests {
    /// Four provenances, four treatments, each derived from the evidence rather than in the view.
    @Test(arguments: [
        Reading(tier: .direct, hasBytes: true, provenance: .captured),
        Reading(tier: .derived, hasBytes: true, provenance: .current),
        Reading(tier: .convention, hasBytes: true, provenance: .rendered),
        Reading(tier: .direct, hasBytes: false, provenance: .absent),
    ])
    func `a shot reads its provenance off the evidence`(_ reading: Reading) throws {
        let result = FeedFixture.shot(
            reading.tier,
            bytes: reading.hasBytes ? FeedFixture.onePixelPNG : nil,
        )
        let rows = FeedProjection.rows(from: FeedFixture.looked(at: "shot.png", result))
        let shot = try #require(FeedFixture.galleries(in: rows).first?.shots.first)

        #expect(shot.provenance == reading.provenance)
    }

    /// One row of the table above: what the record carried, and what the gallery must say about it.
    struct Reading: Sendable {
        let tier: Tier
        let hasBytes: Bool
        let provenance: MediaProvenance
    }

    /// A shot the record kept no bytes for is still IN the gallery — the call happened, and
    /// dropping it would be the fold reporting five renders where six were asked for.
    @Test
    func `a picture the record kept no bytes for is shown and opens nothing`() throws {
        let shot = try oneShot(of: nil)

        #expect(shot.isOpenable == false)
        #expect(shot.provenance.words == nil)
    }

    /// Bytes are not a picture. A record can carry a string that is no image at all, and a shot
    /// that read only "were there bytes" would draw an absence and offer a click onto it — the one
    /// combination the absent case exists to prevent.
    @Test
    func `a picture whose bytes are not one at all reads as an absence`() throws {
        let shot = try oneShot(of: "not-a-png")

        #expect(shot.provenance == .absent)
        #expect(shot.isOpenable == false)
    }

    /// The other half of that case, and the one `not-a-png` never reaches: it fails the signature
    /// check outright, where a capture cut short by a dying writer keeps a whole PNG header and
    /// passes it. The projection reads the signature and nothing else, so it says picture here —
    /// and the surface that tries to draw one settles it as `unreadable` (`MediaWaitTests`).
    @Test
    func `a picture cut short after its header reads as one until something draws it`() throws {
        let shot = try oneShot(
            of: MediaFixture.truncated(width: 900, height: 450).base64EncodedString(),
        )

        #expect(shot.provenance == .captured)
        #expect(shot.isOpenable)
    }

    /// The frame is derived beside the words rather than decided inside the view that draws it.
    @Test(arguments: [
        Framing(provenance: .captured, treatment: .bleeding),
        Framing(provenance: .current, treatment: .broken),
        Framing(provenance: .rendered, treatment: .mounted),
        Framing(provenance: .absent, treatment: .broken),
    ])
    func `each provenance is framed as its own treatment`(_ framing: Framing) {
        #expect(framing.provenance.treatment == framing.treatment)
    }

    /// One row of the table above: a provenance, and the frame it is drawn in.
    struct Framing: Sendable {
        let provenance: MediaProvenance
        let treatment: MediaProvenance.Treatment
    }

    @Test
    func `every picture that has bytes opens`() throws {
        let rows = FeedProjection.rows(from: FeedFixture.looked(at: ["a.png", "b.png"]))
        let gallery = try #require(FeedFixture.galleries(in: rows).first)

        #expect(gallery.shots.map(\.isOpenable) == [true, true])
    }

    /// The thumbnail names the file; the lightbox names the path. Both come off the shot, because
    /// the row standing over a gallery names no file at all.
    @Test
    func `a shot carries the filename it is captioned by and the path it opens onto`() throws {
        let rows = FeedProjection.rows(
            from: FeedFixture.looked(at: "docs/renders/at-rest.png", FeedFixture.shot(.direct)),
        )
        let shot = try #require(FeedFixture.galleries(in: rows).first?.shots.first)

        #expect(shot.name == "at-rest.png")
        #expect(shot.address == "docs/renders/at-rest.png")
    }

    /// One picture a call answered with, through the whole projection — which is where a shot's
    /// provenance is settled, and the only place the reading below is the one a reader sees.
    private func oneShot(of bytes: String?) throws -> FeedShot {
        let rows = FeedProjection.rows(
            from: FeedFixture.looked(at: "shot.png", FeedFixture.shot(.direct, bytes: bytes)),
        )
        return try #require(FeedFixture.galleries(in: rows).first?.shots.first)
    }
}
