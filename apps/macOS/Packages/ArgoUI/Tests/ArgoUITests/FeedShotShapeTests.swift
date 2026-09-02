import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import SwiftUI
import Testing

/// What shape a thumbnail is drawn at (#1015). A gallery fixes the HEIGHT and lets the width
/// follow the picture, so a tall capture is narrow and a wide one is wide — and neither is
/// centre-cropped into a 3:2 box it never had.
///
/// Every ratio here is read off the 24 bytes the address already carries, so nothing in this suite
/// reads a file or decodes a pixel: the widths have to be the same before the picture arrives, or
/// the row and the lane would lay out differently for one frame and re-wrap when it landed.
@MainActor
@Suite("The shape of a shot")
struct FeedShotShapeTests {
    private static func shot(width: Int, height: Int) throws -> FeedShot {
        try FeedShot(
            name: "capture.png",
            address: "docs/capture.png",
            media: MediaFixture.media(width: width, height: height),
        )
    }

    @Test
    func `a picture's ratio comes off its signature, with nothing read and nothing decoded`(
    ) throws {
        let bytes = try MediaFixture.bytes(width: 800, height: 400)

        #expect(MediaShape.ratio(of: bytes) == 2)
    }

    /// The other format that says its size inside those 24 bytes, and it says it the other way
    /// round: GIF writes the logical screen descriptor at byte 6 as two bytes LOW ONE FIRST, where
    /// PNG writes IHDR at byte 16 big-endian. 1000 by 250 is the pair that tells the two readings
    /// apart — read high byte first they come back 59395 by 64000, a picture drawn on its side
    /// that nothing downstream can see is wrong, since every surface lays out from this one number.
    @Test
    func `a GIF's size is read low byte first, where a PNG's is read high byte first`() throws {
        let gif = try MediaFixture.gif(width: 1000, height: 250)
        let png = try MediaFixture.png(width: 1000, height: 250)

        #expect(MediaShape.ratio(of: .held(gif.base64EncodedString())) == 4)
        #expect(MediaShape.ratio(of: .held(png.base64EncodedString())) == 4)
    }

    /// The formats that put their dimensions past the 24 bytes an address carries — JPEG, WebP,
    /// HEIC — say nothing this early, and a guess would be worse than the fixed box.
    @Test
    func `a format that does not say how large it is this early answers nothing`() throws {
        let jpeg = try MediaFixture.oriented(width: 800, height: 400, orientation: 1)

        #expect(MediaShape.ratio(of: .held(jpeg.base64EncodedString())) == nil)
        #expect(MediaShape.ratio(of: .held("not-a-picture-at-all")) == nil)
    }

    /// The numbers rather than the arithmetic: 112 points of height at 3:4 is 84 across and at
    /// 2:1 is 224, and a case that recomputed them from the contract would agree with the code
    /// whatever either said.
    @Test
    func `a tall shot is drawn narrow and a wide one wide, both at the one height`() throws {
        let tall = try Self.shot(width: 600, height: 800)
        let wide = try Self.shot(width: 800, height: 400)

        #expect(tall.drawnWidth == 84)
        #expect(wide.drawnWidth == 224)
    }

    /// The band is still a band. A panorama would otherwise take a whole line of the column on its
    /// own, and a column-shaped capture would come out a sliver with nothing readable in it.
    @Test
    func `an extreme ratio is held inside the band's own bounds`() throws {
        let panorama = try Self.shot(width: 4000, height: 200)
        let sliver = try Self.shot(width: 100, height: 4000)

        #expect(panorama.drawnWidth == ArgoFeedRow.shotWidths.upperBound)
        #expect(sliver.drawnWidth == ArgoFeedRow.shotWidths.lowerBound)
    }

    /// No ratio, no reason to be anything but the box the contract fixed — which is what an
    /// absence keeps too, having no picture to take a shape from.
    @Test
    func `a shot whose shape is unknown keeps the fixed box`() {
        let absent = FeedShot(
            name: "gone.png",
            address: "docs/gone.png",
            media: MediaEvidence(tier: .direct, mediaType: "image/png", bytes: nil),
        )

        #expect(absent.ratio == nil)
        #expect(absent.drawnWidth == ArgoFeedRow.shotWidth)
    }

    /// A capture cut short by a dying writer keeps a whole header, so its shape reads exactly as an
    /// intact file's does. A width that fell back to the fixed box on a failed decode would move
    /// the band under the reader when the decode landed, and the lane would go on drawing the
    /// width it was handed.
    @Test
    func `a picture cut short after its header is laid out at the shape its header says`(
    ) throws {
        let torn = try MediaFixture.truncatedMedia(width: 900, height: 450)
        let cut = FeedShot(name: "capture.png", address: "docs/capture.png", media: torn)
        let whole = try Self.shot(width: 900, height: 450)

        #expect(cut.drawnWidth == whole.drawnWidth)
    }

    /// The whole point of the height being the fixed side: whatever a shot's width comes out at,
    /// the run of them caption on one baseline.
    @Test
    func `every shot in a run is drawn at the same height`() throws {
        let shapes = [(600, 800), (800, 400), (300, 300)]
        let shots = try shapes.map { try Self.shot(width: $0.0, height: $0.1) }

        #expect(shots.map(\.drawnWidth) == [84, 224, 112])
        #expect(shots.allSatisfy { ArgoFeedRow.shotWidths.contains($0.drawnWidth) })
    }
}

extension FeedShotShapeTests {
    /// The lane is the reading shrunk, so it and the row lay ONE gallery out the same way — which
    /// is a claim about the row's real layout, not about the arithmetic beside it. The row is asked
    /// with the ruler the table measures rows with; the lane is asked for its rects; and the two
    /// answers have to be the same band.
    @Test(arguments: [316 as CGFloat, 200])
    func `the lane draws the band the row actually laid out`(_ measure: CGFloat) throws {
        let shots = try [(600, 800), (800, 400)].map { try Self.shot(width: $0.0, height: $0.1) }
        let drawn = Self.laidOut(shots, across: measure)
        let rects = MinimapRowShape.shots(shots.map(\.drawnWidth), across: measure)

        #expect(drawn.width == (rects.map(\.to).max() ?? 0))
        #expect(drawn.height
            == (rects.map { $0.y + $0.height }.max() ?? 0) + ArgoFeedRow.shotBreath)
    }

    /// A gallery at the size the feed's own ruler gives it —
    /// `FeedTableCoordinator.measuredHeight`'s
    /// mechanism, and the only answer that says what the reader will see.
    private static func laidOut(_ shots: [FeedShot], across measure: CGFloat) -> CGSize {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        ruler.rootView = AnyView(
            FeedGalleryRow(gallery: FeedGallery(shots: shots), open: { _ in }).argoAppearance(),
        )
        return ruler.sizeThatFits(
            in: NSSize(width: measure, height: CGFloat.greatestFiniteMagnitude),
        )
    }
}
