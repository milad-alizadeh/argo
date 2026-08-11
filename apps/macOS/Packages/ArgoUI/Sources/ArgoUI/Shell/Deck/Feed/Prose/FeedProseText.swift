import SwiftUI

/// A run of the transcript's own words, typeset. Shared by everything that draws prose — a
/// paragraph, a heading, a list item — so the measure, the leading and the reading of the inline
/// marks are decided once. Ink and fold are the caller's claims, not the type's.
struct FeedProseText: View {
    @Environment(\.argo) private var argo
    /// The ink the prose around this run is set in. Ambient because it is a property of the block
    /// being drawn, not of each span inside it.
    @Environment(\.proseVoice) private var voice

    let text: String
    /// Which rung the run is set on. Only MARKUP passes one. The default must stay the contract's
    /// and not a literal — a literal here is how the feed once ended up with two body sizes.
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

    /// The agent's own inline marks, drawn as marks. Inline only, whitespace preserved: every line
    /// break the record carries survives, BLOCK constructs are `MarkdownBlock`'s to find, and a
    /// string markdown cannot parse is drawn as it arrived.
    ///
    /// Read through `ProseReading` rather than here, so the parse happens once per string instead
    /// of once per evaluation of this body.
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
