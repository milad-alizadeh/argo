import ArgoEngine
import CoreGraphics

/// How a picture is SHAPED, off the 24 bytes an address already carries — no file read, no decode.
///
/// A thumbnail is drawn at its own ratio (#1015), and the width that comes out is a fact three
/// places have to agree on before any picture arrives: the row that lays the gallery out, the ruler
/// that measures the row's height, and the lane that draws the row again in miniature. A ratio
/// taken off the decode instead would arrive after all three had already answered, and the reading
/// would re-wrap under the reader as the pictures landed.
///
/// So it is answered from the signature or not at all. PNG writes its dimensions in the IHDR chunk
/// at byte 16 and GIF in the screen descriptor at byte 6, both inside the 24 bytes
/// `MediaBytes.signature` holds; JPEG, WebP, BMP and HEIC carry theirs past it and get the fixed
/// box, where the picture is fitted rather than cropped. Neither format here has an orientation
/// tag, so no reading below can be a quarter turn out.
enum MediaShape {
    /// The picture's width over its height, or nothing where its format does not say so this early.
    static func ratio(of bytes: MediaBytes) -> CGFloat? {
        guard let pixels = pixels(of: bytes), pixels.width > 0, pixels.height > 0 else {
            return nil
        }
        return CGFloat(pixels.width) / CGFloat(pixels.height)
    }

    private static func pixels(of bytes: MediaBytes) -> (width: Int, height: Int)? {
        guard let head = MediaDecode.head(of: bytes).map(Array.init) else { return nil }
        if head.starts(with: png), head.count >= 24 {
            return (bigEndian(head, at: 16, wide: 4), bigEndian(head, at: 20, wide: 4))
        }
        if head.starts(with: gif), head.count >= 10 {
            return (littleEndian(head, at: 6), littleEndian(head, at: 8))
        }
        return nil
    }

    private static let png: [UInt8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    private static let gif = Array("GIF8".utf8)

    private static func bigEndian(_ head: [UInt8], at offset: Int, wide: Int) -> Int {
        head[offset ..< offset + wide].reduce(0) { $0 << 8 | Int($1) }
    }

    /// Two bytes, low one first — GIF's own order, and the only place it is read.
    private static func littleEndian(_ head: [UInt8], at offset: Int) -> Int {
        Int(head[offset]) | Int(head[offset + 1]) << 8
    }
}
