import SwiftUI

/// The inline marks a CLI writes, given the treatment each one earns.
///
/// SwiftUI already draws a `code` span in a mono face, and that is the whole of what it does: the
/// span keeps the ink of the sentence around it. In a paragraph of prose a mono face at the same
/// colour is a signal a reader has to look for, and the run in question is almost always the one
/// they came for — a filename, a flag, the command that failed.
///
/// What marks it is a GROUND, not a hue. The palette rations colour for meaning — brand, four
/// operational states, two diff inks — and a `code` span is a KIND of text rather than a state, so
/// spending a hue on it put the loudest ink in the app on the one text role that answers to
/// nothing. The ground says the same thing and costs no colour; the ink is left to the voice, so a
/// marked run in a thought stays quieter than a marked run in a message.
///
/// This is a reading of the AGENT'S OWN marks and never a parse of what is inside them: a span is
/// marked because it was written between backticks, not because anything guessed at a language.
enum MarkedProse {
    static func inked(
        _ prose: AttributedString,
        span: ArgoColor?,
        link: ArgoColor,
    )
        -> AttributedString {
        var inked = prose
        for run in prose.runs {
            // A link wins over a code span where a span is both — being pressable is the more
            // useful of the two things to say, and colour alone is not what says it: a reader who
            // cannot separate two hues needs the rule under the words.
            if run.link != nil {
                inked[run.range].foregroundColor = link.color
                inked[run.range].underlineStyle = .single
            } else if isCode(run), let span {
                // Set only where the voice's own ink would fall under the floor on the ground —
                // `nil` is the ordinary case and means inherit, which is what keeps a marked run
                // from claiming more than the sentence carrying it.
                inked[run.range].foregroundColor = span.color
            }
        }
        return inked
    }

    /// The same prose as one `Text`, with its link and code runs marked for the renderer.
    ///
    /// Concatenated run by run rather than handed over whole, because a `TextAttribute` is a
    /// property of a `Text` and the thing that needs marking is a span inside one. The pieces
    /// keep every attribute they arrived with, so this changes what the type-setter can SAY about
    /// the paragraph and nothing about how it sets it.
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
