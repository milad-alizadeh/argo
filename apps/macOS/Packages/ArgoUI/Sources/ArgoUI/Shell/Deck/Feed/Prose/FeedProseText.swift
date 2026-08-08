import SwiftUI

/// A block of the transcript's own words, typeset.
///
/// Shared by the two shapes that carry prose, so the measure, the leading and the reading of the
/// text are decided once. Whoever draws it applies its ink and its fold — those are the caller's
/// claims, not the type's.
struct FeedProseText: View {
    let text: String

    var body: some View {
        Text(marked)
            .argoText(ArgoTypography.body)
            .lineSpacing(ArgoFeedRow.proseLineSpacing)
            .multilineTextAlignment(.leading)
    }

    /// The agent's own inline marks, drawn as marks: `code` spans and emphasis are how a CLI
    /// writes, and leaving the punctuation on screen is not more faithful — it is the same string
    /// with its formatting unread.
    ///
    /// Inline only, and whitespace preserved: every line break the record carries survives, and
    /// block constructs (a heading, a list) stay as the agent typed them rather than being
    /// re-laid-out by a renderer this ticket does not build. A string markdown cannot parse is
    /// drawn exactly as it arrived.
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
