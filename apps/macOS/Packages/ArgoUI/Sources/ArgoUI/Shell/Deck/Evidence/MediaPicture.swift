import AppKit
import ArgoEngine

/// A media result's bytes, decoded at the size the surface asking draws them, with what the image
/// itself says about its size.
///
/// Decoding base64 into an `NSImage` is work and a SwiftUI `body` runs whenever anything near it
/// changes, so this is a held value and never a computed property: a gallery of six shots
/// recomputing its pictures on every layout pass is the jitter.
struct MediaPicture {
    let image: NSImage
    /// The image's own pixel dimensions, `nil` where the file did not say. The SOURCE's, not the
    /// bitmap's — a thumbnail is drawn small and still reports what the file is.
    let pixels: (width: Int, height: Int)?
    private let points: CGSize

    init(_ bitmap: MediaBitmap) {
        self.image = bitmap.image
        self.pixels = bitmap.pixels
        self.points = bitmap.points
    }

    /// `1280 × 800`, or nothing at all where the image did not say. Never a guess from the point
    /// size — a dimension the reader can check against the file is the only one worth drawing.
    var spokenSize: String? {
        pixels.map { "\($0.width) × \($0.height)" }
    }

    /// How large the image asks to be drawn. Its POINT size and not its pixel count, which is the
    /// deliberate half: a 2× capture at its pixel count in points is the same picture upscaled and
    /// softer, and full size means one image pixel per device pixel.
    var naturalSize: CGSize {
        points
    }
}

extension MediaEvidence {
    /// Where the picture came from, answering whether there IS one from the file's signature
    /// alone — no decode, and a cost that does not grow with the picture (ADR-0028 Rule 3). For
    /// callers holding no `MediaPicture` — the projection's own reading, and the tests.
    var provenance: MediaProvenance {
        MediaProvenance(self, showing: bytes.map(MediaDecode.isPicture) ?? false)
    }
}
