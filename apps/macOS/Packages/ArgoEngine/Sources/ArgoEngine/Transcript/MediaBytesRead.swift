import Foundation

/// The bytes behind one address, read NOW.
///
/// `nil` where they cannot be read at all: a transcript truncated or rewritten under us, a picture
/// deleted since the call that showed it. A surface handed `nil` says the picture cannot be shown,
/// never that there was none — the address itself is the record that there was one.
///
/// A `run` is verified against its own signature before it is handed back. Offsets come from the
/// cursor that read the line, and a file rewritten in place would leave them pointing at somebody
/// else's bytes; a signature that no longer matches is a stale address, and the honest answer to a
/// stale address is nothing rather than the wrong picture.
public func mediaData(at bytes: MediaBytes) -> Data? {
    switch bytes.address {
    case let .held(base64):
        Data(base64Encoded: base64)
    case let .file(path):
        try? Data(contentsOf: URL(fileURLWithPath: path))
    case let .run(transcript, at):
        run(of: bytes, in: transcript, at: at)
    }
}

private func run(of bytes: MediaBytes, in transcript: String, at offset: Int) -> Data? {
    guard let handle = try? FileHandle(forReadingFrom: URL(fileURLWithPath: transcript))
    else { return nil }
    defer { try? handle.close() }
    try? handle.seek(toOffset: UInt64(offset))
    guard let run = try? handle.read(upToCount: bytes.count), run.count == bytes.count,
          run.prefix(MediaBytes.signatureLength).elementsEqual(bytes.signature.utf8)
    else { return nil }
    return Data(base64Encoded: run)
}
