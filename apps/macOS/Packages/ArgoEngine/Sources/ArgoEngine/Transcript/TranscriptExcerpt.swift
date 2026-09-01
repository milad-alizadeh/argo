import Foundation

/// A bounded read of one transcript: its head, its tail, and nothing in between.
///
/// What a roster row is made of — a title, the two times, a Turn's state, a chain link — is written
/// either in a transcript's opening records or in its newest ones. The middle is the feed's, and
/// the feed is only ever drawn for the Session on screen. So reading the middle at launch buys the
/// roster nothing and costs it the bytes that made a week-wide working set unaffordable: over the
/// week ADR-0008 was re-measured against — 137 transcripts, 458 MB — the two ends are 16 MB.
struct TranscriptExcerpt {
    /// How much of each end is read. Sized by measurement against that week, at three widths: 64,
    /// 128 and 256 KiB either side read 16, 32 and 61 MB and drew the SAME 105 rows — same titles,
    /// same statuses, same last-seen times, same order. The only fact any of them lost was
    /// `startedAtMs`, absent on 15 rows at 64 KiB against 13 at 256, because a transcript opening
    /// on a large pasted prompt has no timed record inside its first chunk. The roster sorts on the
    /// LATEST time and renders no start, so the narrowest width costs it nothing a reader can see
    /// and reads a quarter of the bytes.
    static let sideByteLimit = 64 * 1024

    /// The complete lines the two ends held, each at its own offset in the file.
    let lines: [TranscriptLine]
    /// Where the read stopped. A tail carries on from here, so nothing is read twice and nothing
    /// appended after this moment is missed.
    let endOffset: Int
    /// Whether the two ends MET — a transcript small enough that its excerpt is its whole reading,
    /// and so a row with nothing degraded about it.
    let isWhole: Bool
    /// Bytes actually asked of the file system. What bounds a launch sweep: whatever the file's
    /// length, this is at most the two ends plus the one partial record the tail read begins on,
    /// and it is the count `TranscriptReadCostTests` gates rather than a duration (ADR-0028 Rule
    /// 8).
    let bytesRead: Int

    /// Read one open file's two ends, leaving the handle wherever it finished. `nil` for a file
    /// whose length cannot be read, which is a file nothing can be bounded against.
    init?(reading handle: FileHandle, sideLimit: Int = Self.sideByteLimit) {
        guard let end = try? handle.seekToEnd() else { return nil }
        let size = Int(clamping: end)
        guard size > sideLimit * 2 else {
            let whole = Self.read(handle, from: 0)
            let split = TranscriptLineSplit(of: whole, at: 0)
            self.lines = split.lines
            self.endOffset = split.remainderOffset
            self.isWhole = true
            self.bytesRead = whole.count
            return
        }
        let headData = Self.read(handle, from: 0, upTo: sideLimit)
        let head = TranscriptLineSplit(of: headData, at: 0)
        let tailData = Self.read(handle, from: size - sideLimit)
        let tail = Self.tail(of: tailData, startingAt: size - sideLimit)
        self.lines = head.lines + Self.marked(tail.lines)
        self.endOffset = tail.remainderOffset
        self.isWhole = false
        self.bytesRead = headData.count + tailData.count
    }

    /// The seam is the tail's FIRST line: what a reader has in hand from there on is later than
    /// what came before it, with a stretch of file missing between the two.
    private static func marked(_ lines: [TranscriptLine]) -> [TranscriptLine] {
        guard let first = lines.first else { return lines }
        return [TranscriptLine(
            text: first.text,
            byteOffset: first.byteOffset,
            followsGap: true,
        )] + lines.dropFirst()
    }

    /// The tail's own split, minus its first line: a read that begins mid-file begins mid-record,
    /// and that record's front is in the stretch this excerpt deliberately does not have.
    private static func tail(of data: Data, startingAt start: Int) -> TranscriptLineSplit {
        guard let firstNewline = data.firstIndex(of: UInt8(ascii: "\n")) else {
            return TranscriptLineSplit(of: Data(), at: start + data.count)
        }
        let after = data.index(after: firstNewline)
        return TranscriptLineSplit(
            of: Data(data[after...]),
            at: start + data.distance(from: data.startIndex, to: after),
        )
    }

    private static func read(
        _ handle: FileHandle,
        from offset: Int,
        upTo count: Int? = nil,
    )
        -> Data {
        try? handle.seek(toOffset: UInt64(offset))
        guard let count else { return (try? handle.readToEnd()) ?? Data() }
        return (try? handle.read(upToCount: count)) ?? Data()
    }
}
