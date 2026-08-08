import AppKit
import ArgoEngine

/// A media result's bytes, decoded once, with what the image itself says about its size.
///
/// A value rather than a computed property on the evidence, because decoding base64 into an
/// `NSImage` is work and a SwiftUI `body` runs whenever anything near it changes — a gallery of six
/// shots recomputing its pictures on every layout pass is the jitter, not a detail of it. Views
/// build one of these once per shot and hold it.
struct MediaPicture {
    let image: NSImage
    /// The image's own pixel dimensions, `nil` where no representation carries them. Read off the
    /// REPRESENTATION rather than `NSImage.size`, which is in points and would report a Retina
    /// screenshot at half the size the file actually is.
    let pixels: (width: Int, height: Int)?

    /// `nil` where there are no bytes, or none that decode. Both are the same thing to a surface:
    /// there is no picture, and it says so rather than drawing a broken one.
    init?(_ media: MediaEvidence) {
        guard let bytes = media.bytes,
              let data = Data(base64Encoded: bytes),
              let image = NSImage(data: data)
        else { return nil }
        self.image = image
        self.pixels = image.representations.first.map { ($0.pixelsWide, $0.pixelsHigh) }
    }

    /// `1280 × 800`, or nothing at all where the image did not say. Never a guess from the point
    /// size — a dimension the reader can check against the file is the only one worth drawing.
    var spokenSize: String? {
        pixels.map { "\($0.width) × \($0.height)" }
    }
}
