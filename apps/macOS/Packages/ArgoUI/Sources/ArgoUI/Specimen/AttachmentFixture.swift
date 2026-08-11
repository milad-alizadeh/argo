import AppKit
import ArgoEngine
import Foundation

/// The attachments every render of the tray is drawn from (#540).
///
/// The image one carries REAL bytes, drawn here rather than shipped as a resource: the chip's
/// whole claim is that it draws the picture and falls back to a glyph, and a fixture with nothing
/// decodable in it would render the fallback every time and prove the opposite of what it was for.
enum AttachmentFixture {
    /// A picture, a source file and a log — the three kinds one tray holds, which is what makes
    /// "one chip shape for every source" a thing to look at rather than a sentence.
    static var mixed: [SessionAttachment] {
        [
            screenshot,
            SessionAttachment(
                name: "SessionRosterProjection.swift",
                byteCount: 6144,
                isImage: false,
                source: .file(URL(filePath: "/argo/SessionRosterProjection.swift")),
            ),
            SessionAttachment(
                name: "ArgoEngineTests-failure.log",
                byteCount: 12288,
                isImage: false,
                source: .file(URL(filePath: "/argo/ArgoEngineTests-failure.log")),
            ),
        ]
    }

    /// What ⌘V leaves behind: no name of its own, so it takes the one the chip shows.
    static var pasted: SessionAttachment {
        SessionAttachment.pastedImage(swatch(), fileExtension: "png")
    }

    /// The state the name ceiling exists for: a chip as wide as the vessel if nothing cut it.
    static var longNames: [SessionAttachment] {
        [
            SessionAttachment(
                name: "Screenshot 2026-08-10 at 09.14.22 — roster after a compaction.png",
                byteCount: 253_952,
                isImage: false,
                source: .file(URL(filePath: "/argo/screenshot.png")),
            ),
            screenshot,
        ]
    }

    /// A dropped screenshot, drawn so the chip has something to decode.
    private static var screenshot: SessionAttachment {
        SessionAttachment(
            name: "Screenshot 2026-08-10 at 09.14.22.png",
            byteCount: 253_952,
            isImage: true,
            source: .bytes(swatch(), fileExtension: "png"),
        )
    }

    /// Two bands of the shell's own graphite, so the thumbnail reads as a picture at 20pt rather
    /// than as a flat tile that could be mistaken for a glyph's ground.
    private static func swatch() -> Data {
        let size = NSSize(width: 64, height: 64)
        let image = NSImage(size: size, flipped: false) { rect in
            NSColor(red: 0.29, green: 0.44, blue: 0.75, alpha: 1).setFill()
            rect.fill()
            NSColor(red: 0.13, green: 0.15, blue: 0.19, alpha: 1).setFill()
            NSRect(x: 0, y: 0, width: rect.width, height: rect.height / 2).fill()
            return true
        }
        guard let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:])
        else { return Data() }
        return png
    }
}
