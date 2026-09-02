import AppKit
import ArgoEngine
import UniformTypeIdentifiers

/// What ⌘V over the composer is holding, read as attachments (#540).
///
/// The pasteboard is read DIRECTLY rather than through the item providers `onPasteCommand` hands
/// over, because the providers resolve asynchronously and a paste is a keystroke: the chip has to
/// be on the tray by the time the user has finished pressing the keys, or the gesture reads as
/// having missed.
///
/// Files win over pixels where the board carries both. Copying a picture in the Finder puts the
/// file's URL AND a preview of it on the board, and the file is the better answer — it has a name,
/// a size, and an address the agent can read without Argo writing anything down.
package enum ComposerPasteboard {
    static func attachments(on board: NSPasteboard = .general) -> [SessionAttachment] {
        if let urls = board.readObjects(forClasses: [NSURL.self]) as? [URL], !urls.isEmpty {
            return urls.map(SessionAttachment.file(at:))
        }
        guard let image = pastedImage(on: board) else { return [] }
        return [image]
    }

    /// A screenshot, or anything else copied as pixels. Normalised to PNG whatever the board
    /// offered, so the extension the path ends in is the truth about the bytes behind it: a
    /// `.tiff` name on PNG data is a file the agent's own reader would be entitled to refuse.
    private static func pastedImage(on board: NSPasteboard) -> SessionAttachment? {
        if let png = board.data(forType: .png) {
            return SessionAttachment.pastedImage(png, fileExtension: "png")
        }
        guard let tiff = board.data(forType: .tiff), let png = Self.png(from: tiff) else {
            return nil
        }
        return SessionAttachment.pastedImage(png, fileExtension: "png")
    }

    /// Pixels in whatever the source offered — TIFF, which is what the pasteboard falls back to and
    /// what `NSImage` hands back when a fixture draws one, or the JPEG a drag can carry instead.
    /// Shared so the paste and the drop cannot re-encode differently.
    package static func png(from data: Data) -> Data? {
        NSBitmapImageRep(data: data)?.representation(using: .png, properties: [:])
    }

    /// The types the composer intercepts ⌘V for. Deliberately NOT text: a paste the field should
    /// have taken must reach the field, and listing `.text` here would turn every quoted paragraph
    /// into an attachment.
    static let pastedTypes: [UTType] = [.image, .fileURL]
}
