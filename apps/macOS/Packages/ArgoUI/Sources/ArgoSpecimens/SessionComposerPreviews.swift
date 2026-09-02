import ArgoAtoms
import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

// Every state of the composer vessel, at the width the feed column gives it. Beside the view
// rather than in it: the vessel's own file is at the house line ceiling, and previews are what it
// is drawn AGAINST rather than part of how it is drawn.
#Preview("Composer — at rest") {
    @Previewable @State var draft = ComposerDraft()

    ComposerPreview(composer: ComposerSpecimen.composer, draft: $draft)
}

#Preview("Composer — holding a draft") {
    @Previewable @State var draft = ComposerSpecimen.typing

    ComposerPreview(composer: ComposerSpecimen.composer, draft: $draft)
}

#Preview("Composer — a send the Session refused") {
    @Previewable @State var draft = ComposerSpecimen.refused

    ComposerPreview(composer: ComposerSpecimen.composer, draft: $draft)
}

#Preview("Composer — a follow-up queued behind a running Turn") {
    @Previewable @State var draft = ComposerSpecimen.queued

    ComposerPreview(composer: ComposerSpecimen.running, draft: $draft)
}

#Preview("Composer — holding standing allows") {
    @Previewable @State var draft = ComposerDraft()

    ComposerPreview(composer: ComposerSpecimen.standing, draft: $draft)
}

#Preview("Composer — the `/` menu over the vessel") {
    @Previewable @State var draft = ComposerSpecimen.commanding

    ComposerPreview(
        composer: ComposerSpecimen.commands,
        draft: $draft,
        commands: { CommandCatalogFixture.machine },
    )
}

#Preview("Composer — the Reduce Transparency fallback") {
    @Previewable @State var draft = ComposerDraft()

    SessionComposer(
        composer: ComposerSpecimen.composer,
        intents: DeckIntents(send: { _, _ in }, draft: $draft),
    )
    .padding(ArgoSpacing.section)
    .frame(width: 760)
    .argoWithoutTransparency()
    .argoDeckSurface()
    .argoAppearance()
}

/// The frame every composer preview draws in.
private struct ComposerPreview: View {
    let composer: SessionComposerProjection.Composer
    @Binding var draft: ComposerDraft
    var commands: () -> CommandCatalog = { CommandCatalog.empty }

    var body: some View {
        SessionComposer(
            composer: composer,
            intents: DeckIntents(send: { _, _ in }, commands: commands, draft: $draft),
        )
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoDeckSurface()
        .argoAppearance()
    }
}
