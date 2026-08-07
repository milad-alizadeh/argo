import Foundation

// A call's result → the image it SHOWED, by ONE fixed source order: the transcript's own embedded
// bytes first, the file on disk only where there are none.
//
// Embedded first because they are what the agent actually LOOKED AT, and because a record cannot be
// invalidated by a later edit to the file. Agents re-render the same screenshot path several times
// within one turn, so reading the path as the primary source would silently show the wrong pixels
// in exactly the debugging loop inline media exists to support, which is worse than showing
// nothing.

/// Reading one image file off disk, base64, or `nil` where it cannot be read at all.
///
/// A port rather than a direct filesystem call, so the source-preference order is falsifiable
/// without a disk — and so a parse given no reader simply has no fallback, rather than a fabricated
/// one.
public typealias ImageReader = @Sendable (String) -> String?

/// The default: no fallback. A parse given no reader reports only what the record carried, which is
/// the honest floor for every test and every caller with no disk to read.
public let noImageReader: ImageReader = { _ in nil }

/// The real one. Reads the file at that path and hands back its bytes, base64.
public let diskImageReader: ImageReader = { path in
    try? Data(contentsOf: URL(fileURLWithPath: path)).base64EncodedString()
}

/// The extensions worth reading from disk, with the type each one means. A table rather than a
/// sniff of the bytes, because the point of this path is to not open a file at all unless its name
/// says it is plausibly an image.
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

/// What the record itself says about the call, in the two places an image can land.
struct MediaRead {
    /// The host's own result object.
    let toolUseResult: JSONValue?
    /// The `tool_result` part's content — the API-shaped blocks the agent was actually sent.
    let content: JSONValue
    /// The file the call named, where re-reading it would MEAN anything. `nil` for a call whose
    /// target is not a path, which is what keeps the fallback from trying to open a regex.
    let path: String?
}

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

/// One content block as the agent was sent it.
private func fromContent(_ content: JSONValue) -> MediaEvidence? {
    for part in content.array {
        if case let .image(image) = ContentBlock(part: part) {
            return MediaEvidence(tier: .direct, mediaType: image.mediaType, bytes: image.base64)
        }
    }
    return nil
}

/// The file at that path NOW, at the LOWER tier. Only reached where the record embedded nothing.
///
/// A path that names an image and yields no bytes is still a media result rather than nothing: the
/// agent DID look at a picture, and a row saying the picture can no longer be shown is honest where
/// a folded read line is merely silent about it.
private func fromDisk(_ path: String?, _ readImage: ImageReader) -> MediaEvidence? {
    guard let path,
          let mediaType = typeByExtension[(path as NSString).pathExtension.lowercased()]
    else { return nil }
    return MediaEvidence(tier: .derived, mediaType: mediaType, bytes: readImage(path))
}

/// The image a call showed, or `nil` where it showed none — which is every call that is not an
/// image read, and is what keeps a non-image binary out of the feed's media rows.
func mediaEvidence(from read: MediaRead, readImage: ImageReader) -> MediaEvidence? {
    fromToolUseResult(read.toolUseResult)
        ?? fromContent(read.content)
        ?? fromDisk(read.path, readImage)
}
