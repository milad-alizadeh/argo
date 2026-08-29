import CoreGraphics
import ImageIO

/// What a picture file says about ITSELF, read off its header and never paid for with a decode.
///
/// Both numbers are as the picture is DISPLAYED, not as it is stored: an EXIF orientation of a
/// quarter turn swaps them, which is what `NSImage(data:)` and a transformed thumbnail both do, so
/// a caption, a plate and a lightbox of one byte run agree about which way round it is.
struct MediaHeader: Sendable {
    /// The pixel dimensions, `nil` where the file did not say.
    let pixels: (width: Int, height: Int)?
    /// How large the file asks to be drawn, in points: its pixels at its own stated resolution,
    /// 72 dpi to the inch, per AXIS — a scan with 144 dpi across and 72 down is drawn half as wide
    /// and full height, which is the arithmetic `NSBitmapImageRep.size` does.
    let points: CGSize

    init(pixels: (width: Int, height: Int)?, points: CGSize) {
        self.pixels = pixels
        self.points = points
    }

    init(of source: CGImageSource) {
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
        guard let properties,
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int
        else {
            self.init(pixels: nil, points: .zero)
            return
        }
        let stored = CGSize(
            width: CGFloat(width) / Self.perPoint(properties[kCGImagePropertyDPIWidth]),
            height: CGFloat(height) / Self.perPoint(properties[kCGImagePropertyDPIHeight]),
        )
        // 5 through 8 are the orientations that put the stored width down the screen.
        let turned = (5 ... 8).contains((properties[kCGImagePropertyOrientation] as? Int) ?? 1)
        self.init(
            pixels: turned ? (height, width) : (width, height),
            points: turned ? CGSize(width: stored.height, height: stored.width) : stored,
        )
    }

    /// Pixels to the point. One where the file said nothing, or said zero — a resolution of none is
    /// a file drawn at its own pixel count, never one divided by nothing.
    private static func perPoint(_ dpi: Any?) -> CGFloat {
        guard let dpi = dpi as? CGFloat, dpi > 0 else { return 1 }
        return dpi / 72
    }
}
