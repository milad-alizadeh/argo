import Foundation

/// Text of the same shape as what it replaces and none of its meaning: every letter comes off one
/// fixed alphabet and every digit is decided by where it sits, while spaces, line breaks,
/// punctuation and path separators stay exactly where they were.
///
/// A replacement depends on the byte's INDEX and on nothing else, which is what makes the pass
/// idempotent: scrambling its own output reproduces it byte for byte.
///
/// A byte over 0x7f is scrambled as a letter, so the output is ASCII whatever went in, one byte
/// per byte — text in a script with no ASCII in it is replaced rather than carried through.
package enum SyntheticLorem {
    /// The markers below are copied through: scrambled, `<task-notification>` stops being one and
    /// its record reads as a prompt — a row of a different kind.
    package static func scrambled(_ text: String) -> String {
        let bytes = Array(text.utf8)
        var out: [UInt8] = []
        out.reserveCapacity(bytes.count)
        var at = 0
        while at < bytes.count {
            let marker = markerLength(in: bytes, at: at)
            guard marker == 0 else {
                out.append(contentsOf: bytes[at ..< at + marker])
                at += marker
                continue
            }
            out.append(replaced(bytes[at], at: at))
            at += 1
        }
        // Cannot fail: every byte written above is ASCII, letters and digits included.
        return String(bytes: out, encoding: .utf8) ?? ""
    }

    private static let alphabet = Array("loremipsumdolorsitametconsecteturadipiscingelit".utf8)

    private static func replaced(_ byte: UInt8, at index: Int) -> UInt8 {
        if byte >= UInt8(ascii: "0"), byte <= UInt8(ascii: "9") {
            return UInt8(ascii: "0") + UInt8(index % 10)
        }
        guard isLetter(byte) else { return byte }
        let letter = alphabet[index % alphabet.count]
        // An upper-case letter stays upper-case: `MERGED` and `merged` are different lengths of
        // word to a reader who wraps them, and a run's case is part of what it looks like.
        return byte >= UInt8(ascii: "A") && byte <= UInt8(ascii: "Z")
            ? letter - 32
            : letter
    }

    private static func isLetter(_ byte: UInt8) -> Bool {
        byte > 0x7F
            || (byte >= UInt8(ascii: "a") && byte <= UInt8(ascii: "z"))
            || (byte >= UInt8(ascii: "A") && byte <= UInt8(ascii: "Z"))
    }

    /// The tags a transcript's own readers match on, NAMED rather than matched by shape: a rule
    /// that kept every `<lower-case>` tag kept `<hosted-invoice-url>` out of a tool's output too,
    /// which is somebody's word surviving in a fixture that says none do.
    ///
    /// A marker missing from this list is a failed generation rather than a quiet one:
    /// `argo-synthesise` refuses to write a synthetic whose rows stop matching its source's.
    package static let markers = [
        "task-notification", "result", "event", "summary", "status", "tool-use-id", "task-id",
        "command-name", "command-message", "command-args", "local-command-stdout",
    ]

    private static let markup = markers
        .flatMap { [Array("<\($0)>".utf8), Array("</\($0)>".utf8)] }

    /// How many bytes of marker start here, or zero where none does.
    private static func markerLength(in bytes: [UInt8], at start: Int) -> Int {
        guard bytes[start] == UInt8(ascii: "<") else { return 0 }
        for marker in markup where starts(bytes, at: start, with: marker) {
            return marker.count
        }
        return 0
    }

    private static func starts(_ bytes: [UInt8], at start: Int, with marker: [UInt8]) -> Bool {
        guard start + marker.count <= bytes.count else { return false }
        return Array(bytes[start ..< start + marker.count]) == marker
    }
}
