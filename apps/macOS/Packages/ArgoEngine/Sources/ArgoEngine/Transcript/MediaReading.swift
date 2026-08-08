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
///
/// An `edit` never shows one, whatever its result carried: a `Write` to an `.svg` is a change to a
/// file, and answering it with a picture would replace the diff of what changed with a render of
/// what it became.
func mediaEvidence(of call: ResolvedCall, readImage: ImageReader) -> MediaEvidence? {
    guard call.kind != .edit else { return nil }
    return fromToolUseResult(call.toolUseResult)
        ?? fromContent(call.content)
        ?? fromDisk(diskFallbackPath(call), readImage)
}

/// The path worth RE-READING, which is much narrower than the path the call named.
///
/// Three gates, each closing a case where a disk read answers the wrong question. Only a read,
/// because a search's pattern, a command line and a subagent's description all land in the same
/// field and none names a file. Only a call that COMPLETED, because a failed read of a `.png` has
/// an error message worth showing and a picture of the file as it stands now does not explain the
/// failure. And only where the result carried no text of its own: Claude Code hands an `.svg` back
/// as SOURCE, and rendering that as a picture would pull a real text row out of the quiet fold.
private func diskFallbackPath(_ call: ResolvedCall) -> String? {
    guard call.kind == .read, call.status == .completed else { return nil }
    return printedOutput(of: call.content) == nil ? call.target : nil
}
