import Foundation

// A call's result → the image it SHOWED, by ONE fixed source order: the transcript's own embedded
// bytes first, the file on disk only where there are none.
//
// Embedded first because they are what the agent actually LOOKED AT: agents re-render the same
// screenshot path several times within one turn, so reading the path first shows the wrong pixels.

/// Reading the HEAD of one image file off disk — enough base64 to carry its signature, and how long
/// the whole run would be — or `nil` where it cannot be read at all. A port, so the
/// source-preference order is falsifiable without a disk.
///
/// The head and never the file: this used to hand back every byte base64-encoded, which is how a
/// path a call merely NAMED came to be retained as a picture (#989). The pixels are read when a
/// surface draws them, off the address this returns.
public typealias ImageReader = @Sendable (String) -> MediaBytes?

/// The default: no fallback. A parse given no reader reports only what the record carried.
public let noImageReader: ImageReader = { _ in nil }

/// The real one. Reads the first 24 bytes of the file at that path and states how long its whole
/// base64 encoding would be — one small read where this used to read whole captures into memory.
public let diskImageReader: ImageReader = { path in
    let url = URL(fileURLWithPath: path)
    guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
    defer { try? handle.close() }
    guard let head = try? handle.read(upToCount: MediaBytes.signatureLength / 4 * 3),
          !head.isEmpty,
          let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize
    else { return nil }
    return MediaBytes(
        address: .file(path: path),
        signature: head.base64EncodedString(),
        // What the whole file encodes to: three bytes to four characters, rounded up to a quantum.
        count: (size + 2) / 3 * 4,
    )
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

/// Where a base64 run sits, given the line that carried it — or the run itself, for a reading with
/// no file behind it.
///
/// The needle is the WHOLE run and not its head, which cost two of 224 real pictures before it was:
/// a PNG's first 24 bytes are its signature, its IHDR length and tag, and its two dimensions — so
/// two captures of one window size have the same 32 base64 characters, and a record carrying both
/// addressed the second at the first's offset. The whole run is the only prefix nothing shares.
///
/// Neither string is copied to be searched (`byteOffset`), so what this costs is the memmem, which
/// is linear in the line — and the line is the picture, once.
func addressed(_ base64: String?, in location: MediaLocation?) -> MediaBytes? {
    guard let base64 = presentBytes(base64) else { return nil }
    guard let location, let at = byteOffset(of: base64, in: location)
    else { return .held(base64) }
    return MediaBytes(
        address: .run(transcript: location.transcript, at: location.byteOffset + at),
        base64: base64,
    )
}

/// Where `needle` starts in the line, in bytes. Over the strings' own UTF-8 buffers rather than
/// through `Data`, so neither the line nor the needle is copied to be searched — which is what
/// makes searching for a whole 1.4 MB capture affordable.
private func byteOffset(of needle: String, in location: MediaLocation) -> Int? {
    var line = location.line
    var needle = needle
    return line.withUTF8 { haystack in
        needle.withUTF8 { pin -> Int? in
            guard let base = haystack.baseAddress, let target = pin.baseAddress,
                  let hit = memmem(base, haystack.count, target, pin.count)
            else { return nil }
            return UnsafeRawPointer(hit) - UnsafeRawPointer(base)
        }
    }
}

/// The host's own result object: `{"type": "image", "file": {"base64": …, "type": …}}`.
private func fromToolUseResult(_ raw: JSONValue?, _ location: MediaLocation?) -> MediaEvidence? {
    guard let raw, raw.stringField("type") == "image", let file = raw["file"],
          let mediaType = imageMediaType(file.stringField("type"))
    else { return nil }
    return MediaEvidence(
        tier: .direct,
        mediaType: mediaType,
        bytes: addressed(file.stringField("base64"), in: location),
    )
}

/// Every picture a record's own parts carried, in the order it carried them. `direct` for all of
/// them: these are the bytes the record embedded, which is what the agent was actually sent.
func embeddedMedia(_ content: [ContentBlock], in location: MediaLocation?) -> [MediaEvidence] {
    content.compactMap { block in
        guard case let .image(image) = block else { return nil }
        return MediaEvidence(
            tier: .direct,
            mediaType: image.mediaType,
            bytes: addressed(image.base64, in: location),
        )
    }
}

/// One content block as the agent was sent it.
private func fromContent(_ content: JSONValue, _ location: MediaLocation?) -> MediaEvidence? {
    embeddedMedia(content.array.map(ContentBlock.init(part:)), in: location).first
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
func mediaEvidence(
    of call: ResolvedCall,
    readImage: ImageReader,
    in location: MediaLocation?,
)
    -> MediaEvidence? {
    guard call.kind != .edit else { return nil }
    return fromToolUseResult(call.toolUseResult, location)
        ?? fromContent(call.content, location)
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
