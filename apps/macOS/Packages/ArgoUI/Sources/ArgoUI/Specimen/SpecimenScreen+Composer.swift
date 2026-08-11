import SwiftUI

// The composer's own catalog entries, split off the main switch: eight states of one vessel is
// most of a file on its own, and they are read together far more often than they are read beside
// the roster's.

extension SpecimenScreen {
    @ViewBuilder var composerCase: some View {
        switch specimen {
        case .composerTyping:
            // A multi-line draft, because the growth past one line is the state — and whether
            // six lines still leave a vessel rather than a wall is the judgement.
            ComposerSpecimen(draft: ComposerSpecimen.typing)
        case .composerCeiling:
            // Past the six-line ceiling, where the field stops growing and scrolls inside itself.
            // The judgement is whether the feed above is still a reading rather than a strip.
            ComposerSpecimen(draft: ComposerSpecimen.ceiling)
        case .composerDraftKept:
            // A draft that survived leaving the Session: simply there, with one quiet line saying
            // it was kept and when. No offer to restore it — nothing was lost (#539).
            ComposerSpecimen(draft: ComposerSpecimen.kept)
        case .composerQueued:
            // A follow-up held above the field while the Turn it waits on runs, cancellable where
            // it stands, and a field inviting the next one rather than a message.
            ComposerSpecimen(composer: ComposerSpecimen.running, draft: ComposerSpecimen.queued)
        case .composerRefusal:
            // A refused send: the message still where it was typed, the reason on the seam
            // above the vessel, and a way to try again.
            ComposerSpecimen(draft: ComposerSpecimen.refused)
        case .flatComposer:
            // The shipping gate every glass surface carries: legible, findable and pressable
            // with the optical response taken away.
            sessions(FeedProjection.previewRows, composer: ComposerSpecimen.composer)
                .argoWithoutTransparency()
        case .composerStanding:
            // The tray at rest, which is where a standing allow has to be findable: the turn AFTER
            // the grant, with the prompt that made it long gone (#572).
            sessions(FeedProjection.previewRows, composer: ComposerSpecimen.standing)
        // `.composer` and anything the outer switch routes here without an arm of its own: the
        // composed state, which only the deck can show — the glass vessel against the reading, the
        // fade letting rows run under it, and the newest line standing clear.
        default:
            sessions(FeedProjection.previewRows, composer: ComposerSpecimen.composer)
        }
    }
}
