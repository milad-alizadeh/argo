import SwiftUI

/// A run of the transcript's own words, typeset.
///
/// Shared by everything that draws prose — a paragraph, a heading, a list item — so the measure,
/// the leading and the reading of the inline marks are decided once. Whoever draws it applies its
/// ink and its fold; those are the caller's claims, not the type's.
struct FeedProseText: View {
    @Environment(\.argo) private var argo
    /// The ink the prose around this run is set in. Ambient rather than a parameter: it is a
    /// property of the block being drawn, not of each span inside it, and threading it through
    /// every markdown construct that can hold prose would put the same value in four signatures
    /// to serve one case.
    @Environment(\.proseVoice) private var voice

    let text: String
    /// Which rung the run is set on. Only MARKUP passes one — a heading is the same words at a
    /// bigger size, and nothing else about typesetting them changes.
    ///
    /// The default is the contract's, not a literal. It was `title3` spelled out here, which is
    /// how the feed ended up with two body sizes after the contract moved to one: a prompt and a
    /// message took this default while the call line beside them took `ArgoTypography.body`.
    var rung: ArgoTypeScale = ArgoFeedRow.proseRung
    var weight: Font.Weight?

    /// Where this paragraph's links ended up once it wrapped. Reported by the renderer, because
    /// wrapping is the only thing that knows.
    @State private var links: [ProseLinkRun] = []

    var body: some View {
        MarkedProse.composed(inked)
            .argoText(rung, weight)
            .lineSpacing(ArgoFeedRow.proseLineSpacing)
            .multilineTextAlignment(.leading)
            .textRenderer(ProseRenderer(marked: argo.color.surface.marked) { found in
                guard found != links else { return }
                links = found
            })
            .proseLinks(links)
    }

    @MainActor private var inked: AttributedString {
        MarkedProse.inked(
            marked,
            span: span,
            link: argo.color.interaction.accent,
        )
    }

    /// What a `code` span is inked in: nothing at all, unless the voice around it would fall under
    /// the contrast floor once the span's ground lifts the backdrop out from under it. The choice
    /// itself is the palette's — see `TextRoles.marked(on:)`.
    private var span: ArgoColor? {
        guard let voice else { return nil }
        let floored = argo.color.text.marked(on: voice)
        return floored == voice ? nil : floored
    }

    /// The agent's own inline marks, drawn as marks: `code` spans and emphasis are how a CLI
    /// writes, and leaving the punctuation on screen is not more faithful — it is the same string
    /// with its formatting unread.
    ///
    /// Inline only, and whitespace preserved: every line break the record carries survives, and the
    /// BLOCK constructs are `MarkdownBlock`'s to find, because a block is a shape on the screen
    /// rather than a span inside a line. A string markdown cannot parse is drawn as it arrived.
    ///
    /// Read through `ProseReading` rather than here, so the parse happens once per string instead
    /// of once per evaluation of this body — which is what a prompt's two hidden rulers, and a seam
    /// being dragged, otherwise multiply.
    @MainActor private var marked: AttributedString {
        ProseReading.marked(text)
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
