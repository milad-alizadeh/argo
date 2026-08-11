import ArgoEngine
import ImageIO
import SwiftUI

/// The picture on an image attachment's chip — the study's "20pt leading thumbnail (images)".
///
/// Decoded at the chip's own measure and no larger: ImageIO reads a thumbnail rather than the whole
/// file, so a 12-megapixel screenshot on the tray costs what a 40-pixel square costs. A picture the
/// bytes will not yield comes back absent and the chip falls back to the kind glyph — the same
/// degrade the feed's media results make, and for the same reason.
///
/// **Off the main actor**, because bounding the OUTPUT does not bound the read: the file still has
/// to be opened and its header parsed, and a tray of chips doing that on the composer's own actor
/// is the vessel not drawing while a disk is slow.
enum AttachmentThumbnail {
    /// Twice the chip's height, so the mark is sharp on a Retina panel without holding the file.
    private static let maxPixels = ArgoComposerVessel.chipHeight * 2

    static func image(for attachment: SessionAttachment) async -> Image? {
        let source = attachment.source
        let decoded = await Task.detached(priority: .userInitiated) {
            decode(source)
        }.value
        return decoded.map { Image(decorative: $0, scale: 1) }
    }

    private static func decode(_ source: SessionAttachment.Source) -> CGImage? {
        guard let image = imageSource(source) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ]
        return CGImageSourceCreateThumbnailAtIndex(image, 0, options as CFDictionary)
    }

    private static func imageSource(_ source: SessionAttachment.Source) -> CGImageSource? {
        switch source {
        case let .file(url):
            CGImageSourceCreateWithURL(url as CFURL, nil)
        case let .bytes(data, _):
            CGImageSourceCreateWithData(data as CFData, nil)
        }
    }
}
