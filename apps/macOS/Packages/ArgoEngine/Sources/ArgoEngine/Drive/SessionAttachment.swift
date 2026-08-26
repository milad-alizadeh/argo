import Foundation
import UniformTypeIdentifiers

/// One thing the user gave a Session before its next Turn went — a file dropped on the composer, an
/// image pasted from the clipboard, a file chosen through the `+`.
///
/// **One shape for every source.** A pasted screenshot and a dropped file differ only in the name
/// the chip derives, because the user's model of "I gave the agent this" is one thing.
///
/// It carries WHERE the bytes are rather than the bytes themselves wherever it can. A file already
/// on disk has an absolute path the agent can read, and copying it would leave a second, staler
/// version of a file the Session may be working in sitting beside the one it is working in. Only a
/// paste — bytes with nowhere to be read from — has to be written down at all.
public struct SessionAttachment: Identifiable, Equatable, Sendable {
    /// Where the bytes can be got.
    public enum Source: Equatable, Sendable {
        /// A file that already exists. Its own path is what the Turn names.
        case file(URL)
        /// Bytes the pasteboard held and nothing on disk does. `AttachmentStore` gives these an
        /// address before a Turn can name one.
        case bytes(Data, fileExtension: String)
    }

    public let id: UUID
    /// What the chip says — the file's own name, or the words a paste has instead of one.
    public let name: String
    /// How big it is, for the chip's mono figure. Zero where the size could not be read, which
    /// renders as an absent figure rather than as `0 bytes`.
    public let byteCount: Int
    /// Whether the chip draws the picture itself rather than a kind glyph. Read off the file's own
    /// declared TYPE rather than off its extension, for the reason the feed's media results are: a
    /// screenshot saved without one is still a picture, and the extension is a guess about a fact
    /// the file system already holds.
    public let isImage: Bool
    public let source: Source

    public init(
        id: UUID = UUID(),
        name: String,
        byteCount: Int,
        isImage: Bool,
        source: Source,
    ) {
        self.id = id
        self.name = name
        self.byteCount = byteCount
        self.isImage = isImage
        self.source = source
    }

    /// A file the user dropped, or picked through the `+`.
    ///
    /// Size and kind are read from the file itself and degrade to absent rather than to a guess: a
    /// path Argo cannot stat is still a path the agent can be pointed at, so the chip loses its
    /// figure and keeps its name.
    public static func file(at url: URL) -> SessionAttachment {
        let read = try? url.resourceValues(forKeys: [.fileSizeKey, .contentTypeKey])
        return SessionAttachment(
            name: url.lastPathComponent,
            byteCount: read?.fileSize ?? 0,
            isImage: read?.contentType?.conforms(to: .image) ?? false,
            source: .file(url),
        )
    }

    /// An image off the clipboard. It has no name of its own, so it takes the one the chip shows —
    /// the same words in every render of this state, because a name that varied would be a fact
    /// about the paste that Argo does not have.
    public static func pastedImage(_ data: Data, fileExtension: String) -> SessionAttachment {
        image(data, fileExtension: fileExtension, called: pastedImageName)
    }

    /// The same, off a drag rather than the clipboard — a screenshot let go straight from the macOS
    /// preview, which offers its pixels because there is no file yet to offer (#732).
    public static func droppedImage(_ data: Data, fileExtension: String) -> SessionAttachment {
        image(data, fileExtension: fileExtension, called: droppedImageName)
    }

    private static func image(
        _ data: Data,
        fileExtension: String,
        called name: String,
    )
        -> SessionAttachment {
        SessionAttachment(
            name: name,
            byteCount: data.count,
            isImage: true,
            source: .bytes(data, fileExtension: fileExtension),
        )
    }

    /// What a paste is called. Here rather than at the call site so the chip, the specimen and the
    /// study's `paste.png` cannot drift into three names for one thing.
    public static let pastedImageName = "Pasted image"
    public static let droppedImageName = "Dropped image"
}
