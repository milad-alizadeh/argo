import SwiftUI

/// The states of the thing the user speaks THROUGH: the composer, what rides above its field, and
/// the Permission prompt that takes its slot.
///
/// Its own file rather than more arms on the catalog's switch, which had outgrown one for the
/// second time — the same split `SpecimenScreen+Connect.swift` made, and by subject rather than by
/// size: these are the states of one vessel, and the switch above is everything a Session is
/// rendered AS.
///
/// Every case of the catalog is named, the ones drawn elsewhere included. A `default` here would
/// compile the next composer state into rendering nothing at all.
extension SpecimenScreen {
    @ViewBuilder var vessel: some View {
        switch specimen {
        case .composer:
            // The composed state, which only the deck can show: the glass vessel against the
            // reading, the fade letting rows run under it, and the newest line standing clear.
            sessions(FeedProjection.previewRows, composer: ComposerSpecimen.composer)
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
        case .composerAttached:
            // Three chips over a message that refers to them (#540). A picture, a source file and
            // a log in one tray, because "one chip shape for every source" is a claim about the
            // three of them TOGETHER — a tray holding one kind proves nothing about the sentence.
            ComposerSpecimen(draft: ComposerSpecimen.attached)
        case .composerPasted:
            // What ⌘V leaves: one chip named for the gesture rather than for a file. Its own case
            // beside the one above because the judgement is that the two are the SAME chip — a
            // paste reading as a lesser kind of attachment would break the design's one rule.
            ComposerSpecimen(draft: ComposerSpecimen.pasted)
        case .composerDragOver:
            // A file held over the vessel. Only a real drag raises this, so without the case the
            // dashed rim and the wash the study drew are never actually looked at — and what has
            // to be true is that the WHOLE vessel reads as the target rather than a strip of it.
            ComposerSpecimen(isDropTargeted: true)
        case .composerNoAttach:
            // An adapter that takes none: no `+` on the footer at all, and the seam saying what a
            // drop was refused for. The claim is that an ABSENCE reads as a complete footer rather
            // than as a row a control fell out of (design decision 9).
            ComposerSpecimen(
                composer: ComposerSpecimen.noAttach,
                draft: ComposerSpecimen.refusedAttachment,
            )
        case .permission:
            // A gated command holding the composer's slot: the tool and its target verbatim, the
            // amber rim, Allow focused — the state the whole channel exists to raise.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.command)
        case .permissionStanding:
            // The same prompt on a Session that already holds two grants: the standing offer on
            // the footer's trailing edge, and above it the record of what it makes.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.standing)
        case .permissionEdit:
            // The other tool kind the prompt renders: a path and the hunk it would write, with
            // the counts said under the block rather than inside it.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.edit)
        case .flatPermission:
            // The same shipping gate the composer's glass carries.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.command)
                .argoWithoutTransparency()
        // Drawn by the catalog's own switch, or by the Connect flow's. Named rather than
        // defaulted, so the day one of them belongs to this vessel the compiler is what says so.
        case .foundations, .contract, .sessionRows, .ghostedRows, .roster, .churningRoster,
             .archivedRoster, .spawningRoster, .renamedRoster, .editingRow, .toolbarScope,
             .emptyToolbarScope, .projectDrawer, .unreachableProjectDrawer, .emptyProjectDrawer,
             .openProjectDrawer, .deck, .sessionsDeck, .sessionHeader, .externalSessionHeader,
             .orphanedSessionHeader, .longBranchSessionHeader, .contextOk, .contextWarn,
             .contextCrit, .contextUnknown, .contextGuide, .handoffWithheld, .handoffAtWarn,
             .handoffAtCrit, .handoffOnReadOnly, .handoffOnOrphaned, .handedOffReading,
             .sessionSpend, .sessionSpendUnreported, .feed, .feedCalls, .feedNarration,
             .feedCommands, .feedCommandFold, .feedProse, .feedMarkdown, .feedEvidence,
             .feedRunEvidence, .feedSurveyEvidence, .feedSurveyEvidenceStep,
             .feedDocumentEvidence, .evidenceAddresses,
             .feedAttention, .feedPunctuation, .feedPermissionExpired, .feedAgents, .feedAtScale,
             .feedAtScaleEvidence, .feedArriving, .emptyFeed, .feedGallery, .feedSingleShot,
             .feedAbsentShot, .feedLightbox, .planPill, .openPlanPill, .unstartedPlanPill,
             .floatingControls, .flatFloatingControls, .feedLeftBehind, .feedLeftBehindInSilence,
             .twoReadings, .welcome, .connectFresh, .connectFolderOnly, .connectPartly,
             .connectWired, .connectWaiting, .connectRefused, .connectBroken, .projectSettings,
             .connectionStale, .connectionsStale, .connectionNeedsReconnect:
            EmptyView()
        }
    }
}
