import AppKit

// The marked words dressed in the faces they are DRAWN in, which every width and every wrap in the
// feed rests on. Core Text lays nothing out without a font, and one font over the whole string is
// not the string SwiftUI draws: a `code` span is set in the mono, wider per character than the
// interface sans (#766).

extension ProseMetrics {
    /// The marked words with `face` over them, its mono over every `code` run, and the agent's own
    /// emphasis over the runs it wrote between asterisks.
    ///
    /// The emphasis is part of the typeset because it is part of the DRAWING: this string is what
    /// `ProseRun` inks (ADR-0030, Rule 2), and a bold run stamped flat would come out at the wrong
    /// weight and the wrong width in one go.
    ///
    /// The mono still takes the BLOCK's rung, not the run's — `.system(.body, design: .monospaced)`
    /// keeps the body's box and changes only the advances — but it takes the RUN's weight, so a
    /// backticked word inside a bold sentence stays bold.
    static func typeset(_ marked: AttributedString, in face: ProseFace) -> NSAttributedString {
        let string = NSMutableAttributedString(attributedString: NSAttributedString(marked))
        let whole = NSRange(location: 0, length: string.length)
        string.addAttribute(.font, value: face.font, range: whole)
        // Uncoloured, and SAID to be: Core Text's own default foreground is black, and a run with
        // no colour of its own is drawn in that black rather than in whatever the context is
        // filling with — unless this flag says to take the context's. Without it a paragraph came
        // out one shade off its own dark ground.
        //
        // Uncoloured because the ink is the DRAWING's to decide: one typeset answers for a message
        // and for the quieter thought beside it (`ProseRun.draw(at:ink:in:)`).
        string.removeAttribute(.foregroundColor, range: whole)
        string.addAttribute(
            NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String),
            value: true,
            range: whole,
        )
        // Collected before any is applied: mutating an attribute mid-enumeration is undefined even
        // when the key read and the key written differ.
        for (range, intent) in inlineRuns(of: string, in: whole) {
            string.addAttribute(.font, value: emphasised(face, by: intent).font, range: range)
        }
        return string
    }

    /// This face under the marks one run carries. Bold and italic are the agent's; `code` swaps the
    /// design and leaves the rung and the weight where they were.
    private static func emphasised(
        _ face: ProseFace,
        by intent: InlinePresentationIntent,
    )
        -> ProseFace {
        var run = face
        run.isBold = face.isBold || intent.contains(.stronglyEmphasized)
        run.isItalic = intent.contains(.emphasized)
        run.isMachine = face.isMachine || intent.contains(.code)
        return run
    }

    /// The floor under a column holding these words: the widest unbreakable word MEASURED, one word
    /// at a time. Six backticked characters outrun nine in the sans, so the word with the most
    /// characters is not the widest one.
    static func widestWord(in marked: AttributedString, face: ProseFace) -> CGFloat {
        words(of: marked)
            .map { typeset(AttributedString(marked[$0]), in: face).size().width }
            .max() ?? 0
    }

    /// Every run the markdown read left a mark on, with the marks it left.
    private static func inlineRuns(of string: NSAttributedString, in whole: NSRange)
        -> [(NSRange, InlinePresentationIntent)] {
        var runs: [(NSRange, InlinePresentationIntent)] = []
        string.enumerateAttribute(.inlinePresentationIntent, in: whole) { value, range, _ in
            guard let raw = (value as? NSNumber)?.uintValue else { return }
            runs.append((range, InlinePresentationIntent(rawValue: raw)))
        }
        return runs
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
