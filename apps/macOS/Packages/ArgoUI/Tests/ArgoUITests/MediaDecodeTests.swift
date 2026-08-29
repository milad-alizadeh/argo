import AppKit
import ArgoEngine
@testable import ArgoUI
import Testing

/// What a picture is decoded to, and what it then says about itself (#962).
///
/// Every size here is the test's own — a source it made and a plate it passed — so nothing below
/// can agree with the code by reading the same constant. The byte runs are 1300-wide and up, a
/// range no other suite reaches into: two suites sharing a run would share `MediaCache.shared`.
@Suite("Decoding a picture")
@MainActor
struct MediaDecodeTests {
    private static let plate = CGSize(width: 168, height: 112)

    @Test
    func `a shot is decoded no finer than the plate it is drawn in`() throws {
        let bytes = try MediaFixture.png(width: 1300, height: 900)
        let bitmap = try #require(MediaDecode.bitmap(from: bytes, in: .plate(Self.plate), scale: 2))

        // 1300 × 900 is the wider ratio, so covering a 168 × 112 plate scales by 168/1300: the
        // wide side lands on the plate's own 168 points and the tall side on 116, which is
        // 336 × 233 pixels at 2×.
        #expect(bitmap.drawn == CGSize(width: 336, height: 233))
    }

    @Test
    func `a column that bounds only its width is decoded for that width alone`() throws {
        let bytes = try MediaFixture.png(width: 1301, height: 400)
        let column = CGSize(width: 480, height: 0)
        let bitmap = try #require(MediaDecode.bitmap(from: bytes, in: .plate(column), scale: 1))

        // A plate with a real height would cover THAT too, and this 3.25:1 picture in a
        // 480-square box comes out 1561 wide — three times the pixels the column has room for.
        #expect(bitmap.drawn == CGSize(width: 480, height: 148))
    }

    @Test
    func `a plate with no area at all is not decoded at full resolution`() throws {
        let bytes = try MediaFixture.png(width: 1302, height: 902)
        let bitmap = try #require(MediaDecode.bitmap(from: bytes, in: .plate(.zero), scale: 2))

        // ImageIO reads a maximum size of 0 as "do not scale" and hands back every pixel the file
        // has — filed as a plate, which is #962's own defect arriving in silence.
        #expect(bitmap.drawn.width < 10)
    }

    @Test
    func `a downsampled shot still says the size the file is`() throws {
        let bytes = try MediaFixture.png(width: 1303, height: 901)
        let bitmap = try #require(MediaDecode.bitmap(from: bytes, in: .plate(Self.plate), scale: 2))

        #expect(MediaPicture(bitmap).spokenSize == "1303 × 901")
    }

    @Test
    func `the lightbox is handed every pixel the file has`() throws {
        let bytes = try MediaFixture.png(width: 1304, height: 902)
        let bitmap = try #require(MediaDecode.bitmap(from: bytes, in: .full, scale: 2))

        #expect(bitmap.drawn == CGSize(width: 1304, height: 902))
    }

    @Test
    func `a plate and a full frame of one picture ask to be drawn at one size`() throws {
        let bytes = try MediaFixture.png(width: 1308, height: 908, drawnAt: 2)
        let plate = try #require(MediaDecode.bitmap(from: bytes, in: .plate(Self.plate), scale: 2))
        let full = try #require(MediaDecode.bitmap(from: bytes, in: .full, scale: 2))

        // The file says two pixels to the point, so it asks to be drawn at about 654 × 454
        // whichever way it was decoded. A plate answering with its own pixel count would resize
        // the lightbox's picture the moment the full frame landed behind it. Within a point
        // rather than on it: a PNG stores resolution as whole pixels per METRE, so 144 dpi comes
        // back as 143.99 on an SDK that does not round it.
        let asked = MediaPicture(plate).naturalSize
        #expect(abs(asked.width - 654) < 1)
        #expect(abs(asked.height - 454) < 1)
        #expect(MediaPicture(full).naturalSize == asked)
        #expect(MediaPicture(full).naturalSize == NSImage(data: bytes)?.size)
    }

    @Test
    func `a file with a different resolution on each axis is drawn to both`() throws {
        let bytes = try MediaFixture.resolved(
            width: 1310, height: 900, dpiWide: 144, dpiHigh: 72,
        )
        let full = try #require(MediaDecode.bitmap(from: bytes, in: .full, scale: 2))

        // 144 across is two pixels to the point and 72 down is one, so a 1310 × 900 scan asks to
        // be drawn 655 across and 900 down. Reading the width's resolution for both axes halves
        // the height too and the picture comes out the wrong shape.
        #expect(MediaPicture(full).naturalSize == CGSize(width: 655, height: 900))
        #expect(MediaPicture(full).naturalSize == NSImage(data: bytes)?.size)
    }

    @Test
    func `a picture the file says is turned reports the size it is drawn at`() throws {
        let bytes = try MediaFixture.oriented(width: 1320, height: 900, orientation: 6)
        let plate = try #require(MediaDecode.bitmap(from: bytes, in: .plate(Self.plate), scale: 2))
        let full = try #require(MediaDecode.bitmap(from: bytes, in: .full, scale: 2))

        // Stored 1320 across, quarter-turned, so AppKit draws it 900 across — and the thumbnail is
        // transformed too. Sizing off the STORED dimensions asks for a thumbnail 168 points wide
        // and gets one 126 wide, which is the under-covering `MediaBox.covers` exists to prevent.
        #expect(MediaPicture(full).spokenSize == "900 × 1320")
        #expect(MediaPicture(plate).spokenSize == MediaPicture(full).spokenSize)
        #expect(MediaPicture(full).naturalSize == NSImage(data: bytes)?.size)
        #expect(plate.drawn.width >= Self.plate.width * 2)
    }

    @Test
    func `settling a shot's provenance decodes no picture and holds none`() throws {
        let media = try MediaFixture.media(width: 1409, height: 909)
        let bytes = try #require(media.bytes)

        #expect(media.provenance == .captured)
        #expect(MediaCache.shared.held(bytes) == nil)
    }

    @Test
    func `settling a shot's provenance costs the same whatever the picture weighs`() throws {
        let small = try MediaFixture.noisyBase64(width: 40, height: 30)
        let large = try MediaFixture.noisyBase64(width: 1330, height: 900)

        // The feed settles this for every shot on every re-projection, so its cost may not scale
        // with the picture (ADR-0028 Rule 3). Decoding the base64 to read a header made it scale
        // exactly: 5.6 ms per body pass over twenty 1.1 MB captures against 0.015 ms for the
        // signature — a debug build on an Apple silicon laptop.
        #expect(large.utf8.count > small.utf8.count * 100)
        let cheap = Self.leastCostOfSettling(small)
        let dear = Self.leastCostOfSettling(large)

        #expect(dear < cheap * 4)
    }

    @Test
    func `a lightbox opening on a plate nobody held still says where the picture came from`()
        throws {
        let media = try MediaFixture.media(width: 1410, height: 910)
        let bytes = try #require(media.bytes)
        #expect(MediaCache.shared.held(bytes) == nil)

        let showing = MediaShowing.atOnce(media, drawnIn: .full)

        // A bounded cache cannot promise the plate is still there, so reading the claim off the
        // absence drops "as the agent saw it" for the 25 ms the full frame takes, and the caption
        // reflows under the reader mid-fade.
        #expect(showing.picture == nil)
        #expect(showing.provenance == .captured)
    }

    @Test
    func `bytes that are not a picture show none`() {
        let media = MediaEvidence(tier: .direct, mediaType: "image/png", bytes: "bm90IGEgcG5n")

        #expect(media.provenance == .absent)
    }

    @Test
    func `the density comes from the densest display attached, not the main one`() {
        // A window on a Retina panel beside a 1× display set as the main one draws at 2×, and a
        // decode made for 1× is soft there for the life of the process.
        #expect(MediaScale.densest(of: [1, 2]) == 2)
        #expect(MediaScale.densest(of: [2, 1]) == 2)
        #expect(MediaScale.densest(of: []) == 2)
    }

    /// What settling one shot's provenance costs, in CPU time rather than wall clock, fifty times
    /// over. Noise is one-sided, so the least of three trials is the honest reading (ADR-0028
    /// Rule 7).
    private static func leastCostOfSettling(_ bytes: String) -> Duration {
        (0 ..< 3).map { _ in
            let started = threadCPUTime()
            for _ in 0 ..< 50 {
                #expect(MediaDecode.isPicture(bytes))
            }
            return threadCPUTime() - started
        }
        .min() ?? .zero
    }

    /// The CPU this thread has burned. Wall clock would measure whatever else the machine is
    /// doing, which on a laptop running the rest of this suite is most of it.
    private static func threadCPUTime() -> Duration {
        var spent = timespec()
        clock_gettime(CLOCK_THREAD_CPUTIME_ID, &spent)
        return .seconds(spent.tv_sec) + .nanoseconds(spent.tv_nsec)
    }
}
