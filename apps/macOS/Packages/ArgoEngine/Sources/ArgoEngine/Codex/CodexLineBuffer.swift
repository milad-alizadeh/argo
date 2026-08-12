import Foundation

/// The server's stdout, cut back into the lines it was written as.
///
/// A read boundary lands wherever the pipe says it does, so a chunk holds part of a line as often
/// as it holds several, and a decode per chunk would tear a message in half. Bytes rather than text
/// for the same reason: a boundary can fall inside a UTF-8 sequence.
struct CodexLineBuffer {
    private var pending: [UInt8] = []

    /// Every complete line this chunk finished, in order. What is left over waits for the next one.
    mutating func take(_ chunk: [UInt8]) -> [String] {
        pending += chunk
        var lines: [String] = []
        while let end = pending.firstIndex(of: UInt8(ascii: "\n")) {
            let line = String(bytes: pending[..<end], encoding: .utf8)
            pending.removeFirst(end + 1)
            // A line that is not UTF-8 is dropped rather than repaired: it is not a message this
            // client wrote, and a lossy conversion would hand the parser a shape it can act on.
            if let line {
                lines.append(line)
            }
        }
        return lines
    }
}
