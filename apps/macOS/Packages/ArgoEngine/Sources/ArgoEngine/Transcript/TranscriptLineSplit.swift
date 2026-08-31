import Foundation

/// The complete lines in a chunk of a transcript, and the record still being written behind them.
///
/// One splitter, because every reader of a transcript cuts on the same rule: the last element is
/// only a line if the data ended on a newline, and a record caught half-written is
/// indistinguishable
/// from one that is genuinely malformed. The tail reads forwards from a cursor and the excerpt
/// reads
/// the two ends (`TranscriptExcerpt`); both need this and neither needs a second copy of it.
///
/// The offset is taken from the RAW parts, before any of them is turned into a `String`: a line
/// that
/// is not UTF-8 is still bytes the file counted, and dropping it from the tally would mis-address
/// every picture after it (`MediaLocation`).
struct TranscriptLineSplit {
    let lines: [TranscriptLine]
    /// The bytes after the last newline — a record half-written, never a line.
    let remainder: Data
    /// Where `remainder` starts in the FILE, which is what makes an offset addressable.
    let remainderOffset: Int

    init(of data: Data, at offset: Int) {
        var parts = data.split(separator: UInt8(ascii: "\n"), omittingEmptySubsequences: false)
        guard parts.count > 1 else {
            self.lines = []
            self.remainder = data
            self.remainderOffset = offset
            return
        }
        let trailing = parts.removeLast()
        var at = offset
        var lines: [TranscriptLine] = []
        for part in parts {
            if let text = String(data: Data(part), encoding: .utf8) {
                lines.append(TranscriptLine(text: text, byteOffset: at))
            }
            at += part.count + 1
        }
        self.lines = lines
        self.remainder = Data(trailing)
        self.remainderOffset = at
    }
}
