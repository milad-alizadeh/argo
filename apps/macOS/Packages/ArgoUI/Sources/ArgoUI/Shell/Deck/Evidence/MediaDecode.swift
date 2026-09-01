import AppKit
import ArgoEngine
import ImageIO

/// Turning a media result's bytes into a bitmap at the size the surface asking will draw it.
///
/// ImageIO rather than `NSImage(data:)` for anything but the lightbox: a thumbnail made through
/// `CGImageSourceCreateThumbnailAtIndex` never decodes the full frame at all, where a full decode
/// scaled down has already paid for every pixel before it is asked to draw four hundred of them.
enum MediaDecode {
    /// A plate's bitmap is wrapped in an `NSBitmapImageRep` rather than made with
    /// `NSImage(cgImage:size:)`, whose representation reports the point size times the screen's
    /// scale and so misstates by 2× exactly the pixel count this file exists to bound.
    static func bitmap(from data: Data, in box: MediaBox, scale: CGFloat) -> MediaBitmap? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let header = MediaHeader(of: source)
        switch box {
        case .full:
            guard let image = NSImage(data: data) else { return nil }
            // A header that named no pixel dimensions leaves `points` at zero, and the lightbox
            // frames its picture by that number — so the decoded image's own size stands in.
            let framed = header.points == .zero
                ? MediaHeader(pixels: header.pixels, points: image.size)
                : header
            return MediaBitmap(image: image, header: framed, box: box)
        case let .plate(plate):
            let longest = longestSide(covering: plate, of: header.pixels, scale: scale)
            guard let thumbnail = Self.thumbnail(source, longestSide: longest) else { return nil }
            let representation = NSBitmapImageRep(cgImage: thumbnail)
            let image = NSImage(size: representation.size)
            image.addRepresentation(representation)
            return MediaBitmap(image: image, header: header, box: box)
        }
    }

    /// Whether the bytes are a picture at all, from the file's SIGNATURE — the 32 base64 characters
    /// the address carries and nothing else.
    ///
    /// What the projection asks — a shot with no picture is not a control — and it is asked for
    /// every shot on every re-projection, so its cost may not scale with the picture (ADR-0028
    /// Rule 3). It is also the whole reason an address carries a signature: with the bytes read
    /// only where they are drawn, this is the one question about a picture that must be answerable
    /// with no read at all.
    ///
    /// It answers whether the bytes ARE one of these formats, not whether every byte after the
    /// signature is intact. A truncated capture is caught where it is drawn — `MediaShowing` reads
    /// its provenance off the decode itself — and this only ever offers the click.
    static func isPicture(_ bytes: MediaBytes) -> Bool {
        let prefix = String(bytes.signature.prefix(signatureBase64Length))
        guard prefix.utf8.count.isMultiple(of: 4), let head = Data(base64Encoded: prefix)
        else { return false }
        return signatures.contains { runs in
            runs.allSatisfy { head.count >= $0.at + $0.magic.count
                && Array(head[$0.at ..< $0.at + $0.magic.count]) == $0.magic
            }
        }
    }

    /// 32 base64 characters is 24 bytes, which is past the last offset any signature below reads.
    private static let signatureBase64Length = 32

    /// The file signatures ImageIO decodes for, as runs of bytes at fixed offsets — all of a row's
    /// runs must match. WebP is two because `RIFF` alone is also a sound file.
    private static let signatures: [[(at: Int, magic: [UInt8])]] = [
        [(0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
        [(0, [0xFF, 0xD8, 0xFF])],
        [(0, Array("GIF8".utf8))],
        [(0, Array("BM".utf8))],
        [(0, [0x49, 0x49, 0x2A, 0x00])],
        [(0, [0x4D, 0x4D, 0x00, 0x2A])],
        [(0, Array("RIFF".utf8)), (8, Array("WEBP".utf8))],
        [(4, Array("ftyp".utf8))],
    ]

    /// How many pixels the longest side needs so the picture COVERS `plate` at `scale`. A gallery
    /// shot fills its plate and a panel fits inside one, and the covering answer is never the
    /// softer of the two.
    ///
    /// Where the file did not say how large it is, the plate's own longest side is the answer — it
    /// under-samples only an extreme aspect ratio, and only where the header was unreadable.
    ///
    /// Rounded to the NEAREST pixel rather than up: half a pixel is not a visible difference, and
    /// `.up` carries the division's own drift into the answer — 336.00000000000006 asks for 337.
    /// Never zero: ImageIO reads a maximum of 0 as "do not scale" and hands back every pixel the
    /// file has, filed as a plate — #962's own defect, arriving silently.
    static func longestSide(
        covering plate: CGSize,
        of pixels: (width: Int, height: Int)?,
        scale: CGFloat,
    )
        -> Int {
        guard let pixels, pixels.width > 0, pixels.height > 0 else {
            return max(1, Int((max(plate.width, plate.height) * scale).rounded()))
        }
        let cover = max(
            plate.width / CGFloat(pixels.width),
            plate.height / CGFloat(pixels.height),
        )
        return max(1, Int((CGFloat(max(pixels.width, pixels.height)) * cover * scale).rounded()))
    }

    private static func thumbnail(_ source: CGImageSource, longestSide: Int) -> CGImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            // Measured: it costs nothing at the appearance (14.85 ms against 14.04 ms for a 2560 ×
            // 1600 capture) and saves it back on every redraw of the held plate (0.275 ms against
            // 0.311 ms), which a scroll pays far more often than it pays the decode.
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: longestSide,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }
}
