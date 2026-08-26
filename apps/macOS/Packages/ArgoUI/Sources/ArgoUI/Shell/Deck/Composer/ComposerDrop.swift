import AppKit
import ArgoEngine
import CoreTransferable
import UniformTypeIdentifiers

/// One thing let go over the composer, read as an attachment (#732).
///
/// It takes the same two things ⌘V does, and for the same reason: a screenshot dragged straight
/// from the macOS preview has no file yet — that is the whole point of the preview — so it offers
/// its PIXELS and a promise of a file, and a target registered for `URL` alone matches neither.
///
/// The order of the representations below is the rule, and it is `ComposerPasteboard`'s: a file
/// already on disk wins over pixels beside it, because it has a name, a size and an address the
/// agent can read without Argo writing anything down.
struct ComposerDrop: Transferable {
    let attachment: SessionAttachment

    static var transferRepresentation: some TransferRepresentation {
        // A real file, at its own path. Never copied: a second, staler version of a file the
        // Session may be working in is the one thing `SessionAttachment` exists to avoid.
        ProxyRepresentation { (url: URL) in ComposerDrop(attachment: .file(at: url)) }
        // Pixels already in the encoding the bytes will be written in, held verbatim.
        DataRepresentation(importedContentType: .png) {
            ComposerDrop(attachment: .droppedImage($0, fileExtension: "png"))
        }
        // Pixels in anything else, normalised — so the extension the path ends in stays the truth
        // about the bytes behind it, which is `ComposerPasteboard`'s rule for the same reason.
        DataRepresentation(importedContentType: .image) {
            try ComposerDrop(attachment: pixels($0))
        }
        // The promise the preview offers beside its pixels, fulfilled. The file it lands in is the
        // system's own temporary one and is gone after this closure, so the bytes are READ rather
        // than the path kept — `AttachmentStore` gives them an address a Turn can name.
        FileRepresentation(importedContentType: .image) { received in
            try ComposerDrop(attachment: pixels(Data(contentsOf: received.file)))
        }
    }

    /// Pixels a drag offered that would not decode. `DataRepresentation` has no way to decline
    /// other than by throwing, and a drag can offer a type it cannot actually produce.
    struct Unreadable: Error {}

    static func pixels(_ data: Data) throws -> SessionAttachment {
        guard let png = ComposerPasteboard.png(from: data) else { throw Unreadable() }
        return .droppedImage(png, fileExtension: "png")
    }
}
