import ArgoEngine
import CoreTransferable
import UniformTypeIdentifiers

/// One thing let go over the composer, read as an attachment (#732).
///
/// It takes the same two things ⌘V does, and for the same reason: a screenshot dragged straight
/// from the macOS preview has no file yet — that is the whole point of the preview — so it offers
/// its PIXELS and a promise of a file, and a target registered for `URL` alone matches neither.
///
/// The representations are tried in the order they are written, which is what makes a file already
/// on disk win over the pixels beside it — `ComposerPasteboard`'s rule, for its reason.
struct ComposerDrop: Transferable {
    let attachment: SessionAttachment

    /// What the bytes are written as, and so what the path a Turn names ends in.
    private static let fileExtension = "png"

    static var transferRepresentation: some TransferRepresentation {
        // A real file keeps its own path — never copied, or the agent reads a staler version of a
        // file the Session may be working in.
        ProxyRepresentation { (url: URL) in ComposerDrop(attachment: .file(at: url)) }
        // Already in the encoding the bytes will be written in, so held verbatim.
        DataRepresentation(importedContentType: .png) {
            ComposerDrop(attachment: .droppedImage($0, fileExtension: fileExtension))
        }
        // Pixels in anything else, normalised — the extension the path ends in has to stay the
        // truth about the bytes behind it.
        DataRepresentation(importedContentType: .image) {
            try ComposerDrop(attachment: attachment(fromPixels: $0))
        }
        // The promise the preview offers beside its pixels. The file it is fulfilled into is the
        // system's own temporary one and is gone after this closure, so the bytes are READ rather
        // than the path kept — `AttachmentStore` gives them an address a Turn can name.
        FileRepresentation(importedContentType: .image) { received in
            try ComposerDrop(attachment: attachment(fromPixels: Data(contentsOf: received.file)))
        }
    }

    /// Pixels a drag offered that would not decode. A drag can offer a type it cannot actually
    /// produce, and a representation has no way to decline other than by throwing.
    struct Unreadable: Error {}

    private static func attachment(fromPixels data: Data) throws -> SessionAttachment {
        guard let png = ComposerPasteboard.png(from: data) else { throw Unreadable() }
        return .droppedImage(png, fileExtension: fileExtension)
    }
}
