import Foundation

/// The working directory a transcript reports — the only thing on disk that says which Project it
/// belongs to.
///
/// Not the record directory's name: that is a lossy encoding of a path (every `/` and every `.`
/// becomes `-`), so it can be written but never read back.
enum TranscriptOrigin {
    /// Enough of the head to reach the first message-bearing record. Every one of them carries
    /// `cwd`, so the answer is in the opening lines, and reading a whole 40MB transcript to find it
    /// would defeat the point of bounding the sweep at all.
    private static let headByteCount = 64 * 1024

    static func cwd(of url: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        guard let head = try? handle.read(upToCount: headByteCount) else { return nil }
        return cwd(inHead: head)
    }

    /// Cut back to the last newline before decoding. The head is a byte count, so its tail is half
    /// a record and possibly half a character; everything before that newline is whole lines and
    /// decodes as itself rather than as replacement characters.
    private static func cwd(inHead head: Data) -> String? {
        guard let lastNewline = head.lastIndex(of: UInt8(ascii: "\n")),
              let lines = String(bytes: head[..<lastNewline], encoding: .utf8)
        else { return nil }
        return lines
            .split(separator: "\n")
            .lazy
            .compactMap { TranscriptRecord.parse(line: String($0))?.cwd }
            .first
    }
}
