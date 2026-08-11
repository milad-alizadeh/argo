import ArgoEngine
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

/// The picture on an image attachment's chip — the study's "20pt leading thumbnail (images)".
///
/// Drawn at the chip's own measure and no larger: ImageIO decodes a thumbnail rather than the whole
/// file, so a 12-megapixel screenshot on the tray costs what a 40-pixel square costs. A picture the
/// bytes will not yield comes back absent and the chip falls back to the kind glyph — which is the
/// same degrade the feed's media results make, and for the same reason.
enum AttachmentThumbnail {
    /// Twice the chip's height, so the mark is sharp on a Retina panel without holding the file.
    private static let maxPixels = ArgoComposerVessel.chipHeight * 2

    static func image(for attachment: SessionAttachment) -> Image? {
        guard attachment.isImage, let source = source(for: attachment) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ]
        guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(
            source,
            0,
            options as CFDictionary,
        ) else {
            return nil
        }
        return Image(decorative: thumbnail, scale: 1)
    }

    private static func source(for attachment: SessionAttachment) -> CGImageSource? {
        switch attachment.source {
        case let .file(url):
            CGImageSourceCreateWithURL(url as CFURL, nil)
        case let .bytes(data, _):
            CGImageSourceCreateWithData(data as CFData, nil)
        }
    }
}
