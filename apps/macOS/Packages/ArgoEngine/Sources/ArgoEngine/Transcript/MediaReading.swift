import Foundation

// A call's result → the image it SHOWED, by ONE fixed source order: the transcript's own embedded
// bytes first, the file on disk only where there are none.
//
// Embedded first because they are what the agent actually LOOKED AT: agents re-render the same
// screenshot path several times within one turn, so reading the path first shows the wrong pixels.

/// Reading one image file off disk, base64, or `nil` where it cannot be read at all. A port, so
/// the source-preference order is falsifiable without a disk.
public typealias ImageReader = @Sendable (String) -> String?

/// The default: no fallback. A parse given no reader reports only what the record carried.
public let noImageReader: ImageReader = { _ in nil }

/// The real one. Reads the file at that path and hands back its bytes, base64.
public let diskImageReader: ImageReader = { path in
    try? Data(contentsOf: URL(fileURLWithPath: path)).base64EncodedString()
}

/// The extensions worth reading from disk, with the type each one means. A table rather than a
/// sniff of the bytes: this path must not open a file whose name says it is not an image.
private let typeByExtension: [String: String] = [
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "avif": "image/avif",
    "bmp": "image/bmp",
    "svg": "image/svg+xml",
]

/// The host's own result object: `{"type": "image", "file": {"base64": …, "type": …}}`.
private func fromToolUseResult(_ raw: JSONValue?) -> MediaEvidence? {
    guard let raw, raw.stringField("type") == "image", let file = raw["file"],
          let mediaType = imageMediaType(file.stringField("type"))
    else { return nil }
    return MediaEvidence(
        tier: .direct,
        mediaType: mediaType,
        bytes: presentBytes(file.stringField("base64")),
    )
}

/// Every picture a record's own parts carried, in the order it carried them.
///
/// `direct` for all of them: these are the bytes the record embedded, which is what the agent was
/// actually sent. Shared by the result path below and by the prompt path, so an image reaches the
/// feed the same way whoever sent it (#733).
func embeddedMedia(_ content: [ContentBlock]) -> [MediaEvidence] {
    content.compactMap { block in
        guard case let .image(image) = block else { return nil }
        return MediaEvidence(tier: .direct, mediaType: image.mediaType, bytes: image.base64)
    }
}

/// One content block as the agent was sent it.
private func fromContent(_ content: JSONValue) -> MediaEvidence? {
    embeddedMedia(content.array.map(ContentBlock.init(part:))).first
}

/// The file at that path NOW, at the LOWER tier. Only reached where the record embedded nothing.
/// A path that names an image and yields no bytes is still a media result: the agent DID look at a
/// picture, and saying it can no longer be shown is honest where silence is not.
private func fromDisk(_ path: String?, _ readImage: ImageReader) -> MediaEvidence? {
    guard let path,
          let mediaType = typeByExtension[(path as NSString).pathExtension.lowercased()]
    else { return nil }
    return MediaEvidence(tier: .derived, mediaType: mediaType, bytes: readImage(path))
}

/// The image a call showed, or `nil` where it showed none. An `edit` never shows one, whatever its
/// result carried: a `Write` to an `.svg` is a change to a file, and a picture of what it became
/// would displace the diff of what changed.
func mediaEvidence(of call: ResolvedCall, readImage: ImageReader) -> MediaEvidence? {
    guard call.kind != .edit else { return nil }
    return fromToolUseResult(call.toolUseResult)
        ?? fromContent(call.content)
        ?? fromDisk(diskFallbackPath(call), readImage)
}

/// The path worth RE-READING, which is much narrower than the path the call named.
///
/// Only a read: a search's pattern, a command line and a subagent's description all land in the
/// same field and none names a file. Only a COMPLETED call: a failed read of a `.png` has an error
/// message worth showing instead. And only where the result carried no text of its own — Claude
/// Code hands an `.svg` back as SOURCE, which belongs in a text row.
private func diskFallbackPath(_ call: ResolvedCall) -> String? {
    guard call.kind == .read, call.status == .completed else { return nil }
    return printedOutput(of: call.content) == nil ? call.target : nil
}
