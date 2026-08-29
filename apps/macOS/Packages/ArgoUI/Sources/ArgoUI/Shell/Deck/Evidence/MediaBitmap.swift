import AppKit

/// One decoded picture: the bitmap a surface draws, and what the FILE says about its own size.
///
/// A class because AppKit rasterises an `NSImage` once and reuses it, so two surfaces drawing one
/// byte run must be handed the same object.
///
/// `Sendable` on the strength of its own shape and NOT on `NSImage`'s, which carries no
/// `NS_SWIFT_SENDABLE` and gets its conformance here only through AppKit's pre-concurrency import:
/// every property is a `let`, the image is fully made before `init` returns and nothing mutates it
/// after. That is what lets the cache hand one to the main actor and to an off-actor decode alike.
final class MediaBitmap: Sendable {
    let image: NSImage
    /// What the SOURCE says it is. Never the thumbnail's numbers: a downsample must not change
    /// what a caption says the picture is, since that is the one number a reader can check against
    /// the file. Carried rather than read off `image.size` so a thumbnail and a full frame of one
    /// byte run report the SAME size — the lightbox draws whichever has arrived, and a size that
    /// changed under it would resize the picture mid-fade.
    let header: MediaHeader
    /// The box this was decoded for, which is what tells a held decode from one too coarse for a
    /// larger plate.
    let box: MediaBox

    init(image: NSImage, header: MediaHeader, box: MediaBox) {
        self.image = image
        self.header = header
        self.box = box
    }

    var pixels: (width: Int, height: Int)? {
        header.pixels
    }

    var points: CGSize {
        header.points
    }

    /// The bitmap's OWN pixel size — the size it was decoded to rather than the size of the file.
    /// The LARGEST representation, since a multi-page TIFF or an `.ico` carries several and the
    /// first is not reliably the one drawn.
    var drawn: CGSize {
        let representations = image.representations
        guard !representations.isEmpty else { return .zero }
        return CGSize(
            width: representations.map(\.pixelsWide).max() ?? 0,
            height: representations.map(\.pixelsHigh).max() ?? 0,
        )
    }

    /// What holding this costs, as `NSCache` counts costs: 8-bit RGBA, which is what a decoded
    /// picture is kept as. Never zero — an entry accounted free is one eviction can never choose.
    var cost: Int {
        max(1, Int(drawn.width * drawn.height) * MediaCache.bytesPerPixel)
    }
}
