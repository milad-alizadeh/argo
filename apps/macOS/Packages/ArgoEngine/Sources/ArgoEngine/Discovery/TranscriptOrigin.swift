import Foundation

/// The working directory a transcript reports — the only thing on disk that says which Project it
/// belongs to.
///
/// Not the record directory's name: that is a lossy encoding of a path (every `/` and every `.`
/// becomes `-`), so it can be written but never read back.
enum TranscriptOrigin {
    /// How much is asked for at a time. Sized to hold the opening records of an ordinary
    /// transcript, not to be the limit — see `readFirstLines`.
    private static let chunkByteCount = 64 * 1024
    /// Where reading gives up. An opening record can be large (a pasted prompt, an inlined
    /// attachment), so the head is read until a line ENDS rather than to a fixed size; this only
    /// stops a file with no newline in it at all from being read whole.
    private static let headByteLimit = 4 * 1024 * 1024

    static func cwd(of url: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        guard let head = readFirstLines(from: handle) else { return nil }
        return cwd(inHead: head)
    }

    /// Everything up to the last newline the file has to offer, growing the read until one appears.
    ///
    /// Cutting at a newline rather than at a byte count is what keeps the decode honest: the tail
    /// of a fixed-size read is half a record and possibly half a character, and there is no way to
    /// tell that from a record that is genuinely malformed.
    private static func readFirstLines(from handle: FileHandle) -> Data? {
        var head = Data()
        while head.count < headByteLimit {
            guard let chunk = try? handle.read(upToCount: chunkByteCount), !chunk.isEmpty
            else { return nil }
            head.append(chunk)
            if let lastNewline = head.lastIndex(of: UInt8(ascii: "\n")) {
                return head[..<lastNewline]
            }
        }
        return nil
    }

    /// Decoded a line at a time, so one record carrying bytes that are not UTF-8 costs that record
    /// rather than every record before it.
    private static func cwd(inHead head: Data) -> String? {
        head.split(separator: UInt8(ascii: "\n"))
            .lazy
            .compactMap { String(bytes: $0, encoding: .utf8) }
            .compactMap { TranscriptRecord.parse(line: $0)?.cwd }
            .first
    }
}
