import SwiftUI

/// A run of the transcript's own words, typeset.
///
/// Shared by everything that draws prose — a paragraph, a heading, a list item — so the measure,
/// the leading and the reading of the inline marks are decided once. Whoever draws it applies its
/// ink and its fold; those are the caller's claims, not the type's.
struct FeedProseText: View {
    @Environment(\.argo) private var argo

    let text: String
    /// Which rung the run is set on. Only MARKUP passes one — a heading is the same words at a
    /// bigger size, and nothing else about typesetting them changes.
    ///
    /// The default is the contract's, not a literal. It was `title3` spelled out here, which is
    /// how the feed ended up with two body sizes after the contract moved to one: a prompt and a
    /// message took this default while the call line beside them took `ArgoTypography.body`.
    var rung: ArgoTypeScale = ArgoFeedRow.proseRung
    var weight: Font.Weight?

    var body: some View {
        Text(MarkedProse.inked(marked, code: argo.color.text.code))
            .argoText(rung, weight)
            .lineSpacing(ArgoFeedRow.proseLineSpacing)
            .multilineTextAlignment(.leading)
    }

    /// The agent's own inline marks, drawn as marks: `code` spans and emphasis are how a CLI
    /// writes, and leaving the punctuation on screen is not more faithful — it is the same string
    /// with its formatting unread.
    ///
    /// Inline only, and whitespace preserved: every line break the record carries survives, and the
    /// BLOCK constructs are `MarkdownBlock`'s to find, because a block is a shape on the screen
    /// rather than a span inside a line. A string markdown cannot parse is drawn as it arrived.
    private var marked: AttributedString {
        let parsed = try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace),
        )
        return parsed ?? AttributedString(text)
    }
}

#Preview("Feed prose text — the inline marks a CLI writes") {
    FeedProseText(text: "Reading `ArgoPalette` first, because the **ramp** is where it drifted.")
        .padding(ArgoFeedRow.inset)
        .frame(width: 620)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed prose text — line breaks the record carries") {
    FeedProseText(text: "One.\nTwo, on its own line.\n\nThree, after a blank one.")
        .padding(ArgoFeedRow.inset)
        .frame(width: 620)
        .argoDeckSurface()
        .argoAppearance()
}
