import ArgoDesign
import ArgoUI
import SwiftUI

// `ComposerSpecimen`'s own states, beside the type rather than in it: the type's own file is at
// the house line ceiling, and previews are what it is drawn AGAINST rather than part of how it is
// drawn.
#Preview("Composer specimen — typing") {
    ComposerSpecimen(draft: ComposerSpecimen.typing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — at the six-line ceiling") {
    ComposerSpecimen(draft: ComposerSpecimen.ceiling)
        .frame(width: 900, height: 420)
        .argoAppearance()
}

#Preview("Composer specimen — a refused send") {
    ComposerSpecimen(draft: ComposerSpecimen.refused)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a draft that was kept") {
    ComposerSpecimen(draft: ComposerSpecimen.kept)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a queued follow-up") {
    ComposerSpecimen(composer: ComposerSpecimen.running, draft: ComposerSpecimen.queued)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — standing allows") {
    ComposerSpecimen(composer: ComposerSpecimen.standing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — three attachments") {
    ComposerSpecimen(draft: ComposerSpecimen.attached)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a pasted image") {
    ComposerSpecimen(draft: ComposerSpecimen.pasted)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a file held over the vessel") {
    ComposerSpecimen(isDropTargeted: true)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — an adapter that takes no attachments") {
    ComposerSpecimen(
        composer: ComposerSpecimen.noAttach,
        draft: ComposerSpecimen.refusedAttachment,
    )
    .frame(width: 900, height: 320)
    .argoAppearance()
}

#Preview("Composer specimen — a stance the ladder has no rung for") {
    ComposerSpecimen(composer: ComposerSpecimen.nearly)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a stance Argo cannot establish") {
    ComposerSpecimen(composer: ComposerSpecimen.unknownMode)
        .frame(width: 900, height: 320)
        .argoAppearance()
}
