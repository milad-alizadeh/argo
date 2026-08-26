import AppKit

// The marked words dressed in the faces they are DRAWN in, which every width and every wrap in the
// feed rests on. Core Text lays nothing out without a font, and one font over the whole string is
// not the string SwiftUI draws: a `code` span is set in the mono, wider per character than the
// interface sans (#766).

extension ProseMetrics {
    /// The marked words with `face` over them and its mono over every `code` run.
    ///
    /// The mono takes the BLOCK's rung and weight, not the run's: `face.font` is stamped over the
    /// whole string first, so a run's own bold is already gone by here.
    static func typeset(_ marked: AttributedString, in face: ProseFace) -> NSAttributedString {
        let string = NSMutableAttributedString(attributedString: NSAttributedString(marked))
        let whole = NSRange(location: 0, length: string.length)
        string.addAttribute(.font, value: face.font, range: whole)
        let mono = face.monospaced.font
        // Collected before any is applied: mutating an attribute mid-enumeration is undefined even
        // when the key read and the key written differ.
        for range in codeRuns(of: string, in: whole) {
            string.addAttribute(.font, value: mono, range: range)
        }
        return string
    }

    /// The floor under a column holding these words: the widest unbreakable word MEASURED, one word
    /// at a time. Six backticked characters outrun nine in the sans, so the word with the most
    /// characters is not the widest one.
    static func widestWord(in marked: AttributedString, face: ProseFace) -> CGFloat {
        words(of: marked)
            .map { typeset(AttributedString(marked[$0]), in: face).size().width }
            .max() ?? 0
    }

    private static func codeRuns(of string: NSAttributedString, in whole: NSRange) -> [NSRange] {
        var ranges: [NSRange] = []
        string.enumerateAttribute(.inlinePresentationIntent, in: whole) { value, range, _ in
            guard let raw = (value as? NSNumber)?.uintValue,
                  InlinePresentationIntent(rawValue: raw).contains(.code) else { return }
            ranges.append(range)
        }
        return ranges
    }

    /// Ranges of the MARKED string rather than of a plain copy of it — splitting the rendered
    /// `String` drops the marks that decide each word's face.
    private static func words(of marked: AttributedString) -> [Range<AttributedString.Index>] {
        var found: [Range<AttributedString.Index>] = []
        var start: AttributedString.Index?
        for index in marked.characters.indices {
            guard marked.characters[index].isWhitespace else {
                if start == nil {
                    start = index
                }
                continue
            }
            if let from = start {
                found.append(from ..< index)
            }
            start = nil
        }
        if let from = start {
            found.append(from ..< marked.endIndex)
        }
        return found
    }
}
