import SwiftUI

/// The inline marks a CLI writes, given the ink each one earns.
///
/// SwiftUI already draws a `code` span in a mono face, and that is the whole of what it does: the
/// span keeps the ink of the sentence around it. In a paragraph of prose a mono face at the same
/// colour is a signal a reader has to look for, and the run in question is almost always the one
/// they came for — a filename, a flag, the command that failed.
///
/// Colour is not decoration here, it is the marker the backticks stopped being. This is a reading
/// of the AGENT'S OWN marks and never a parse of what is inside them: a span is tinted because it
/// was written between backticks, not because anything guessed at a language.
enum MarkedProse {
    static func inked(
        _ prose: AttributedString,
        code: ArgoColor,
        link: ArgoColor,
    )
        -> AttributedString {
        var inked = prose
        for run in prose.runs {
            if isCode(run) {
                inked[run.range].foregroundColor = code.color
            }
            // Colour alone is not what makes a link a link — a reader who cannot separate the two
            // hues sees an ordinary word. The rule under it is the part that survives that.
            guard run.link != nil else { continue }
            inked[run.range].foregroundColor = link.color
            inked[run.range].underlineStyle = .single
        }
        return inked
    }

    /// The same prose as one `Text`, with its link runs marked for the renderer.
    ///
    /// Concatenated run by run rather than handed over whole, because a `TextAttribute` is a
    /// property of a `Text` and the thing that needs marking is a span inside one. The pieces
    /// keep every attribute they arrived with, so this changes what the type-setter can SAY about
    /// the paragraph and nothing about how it sets it.
    static func composed(_ prose: AttributedString) -> Text {
        prose.runs.reduce(Text("")) { composed, run in
            let words = Text(AttributedString(prose[run.range]))
            guard let url = run.link else { return composed + words }
            return composed + words.customAttribute(ProseLink(url: url))
        }
    }

    private static func isCode(_ run: AttributedString.Runs.Run) -> Bool {
        run.inlinePresentationIntent?.contains(.code) ?? false
    }
}
