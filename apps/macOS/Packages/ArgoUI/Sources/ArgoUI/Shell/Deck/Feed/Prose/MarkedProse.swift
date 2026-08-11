import SwiftUI

/// The inline marks a CLI writes, given the treatment each one earns.
///
/// SwiftUI draws a `code` span in a mono face and nothing else — the span keeps the ink of the
/// sentence around it. What marks it here is a GROUND, not a hue; the ink is left to the voice, so
/// a marked run in a thought stays quieter than one in a message.
///
/// A reading of the AGENT'S OWN marks and never a parse of what is inside them: a span is marked
/// because it was written between backticks, not because anything guessed at a language.
enum MarkedProse {
    static func inked(
        _ prose: AttributedString,
        span: ArgoColor?,
        link: ArgoColor,
    )
        -> AttributedString {
        var inked = prose
        for run in prose.runs {
            // A link wins over a code span where a span is both, and the underline rather than
            // colour alone is what says so.
            if run.link != nil {
                inked[run.range].foregroundColor = link.color
                inked[run.range].underlineStyle = .single
            } else if isCode(run), let span {
                // Set only where the voice's own ink would fall under the floor on the ground;
                // `nil` is the ordinary case and means inherit.
                inked[run.range].foregroundColor = span.color
            }
        }
        return inked
    }

    /// The same prose as one `Text`, with its link and code runs marked for the renderer.
    ///
    /// Concatenated run by run rather than handed over whole, because a `TextAttribute` is a
    /// property of a `Text` and the thing that needs marking is a span inside one. The pieces keep
    /// every attribute they arrived with.
    ///
    /// A code run is marked rather than given a background attribute because
    /// `AttributedString.backgroundColor` fills a tight, square-cornered rectangle around the
    /// glyphs. That reads as highlighter, not as a chip — and the rounded, inset ground the
    /// contract asks for has to be drawn by something that knows where the run landed after
    /// wrapping, which is the renderer.
    static func composed(_ prose: AttributedString) -> Text {
        prose.runs.reduce(Text(verbatim: "")) { composed, run in
            var words = Text(AttributedString(prose[run.range]))
            if let url = run.link {
                words = words.customAttribute(ProseLink(url: url))
            } else if isCode(run) {
                words = words.customAttribute(ProseCode())
            }
            return Text("\(composed)\(words)")
        }
    }

    private static func isCode(_ run: AttributedString.Runs.Run) -> Bool {
        run.inlinePresentationIntent?.contains(.code) ?? false
    }
}
