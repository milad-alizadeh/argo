import SwiftUI

/// The Connect flow's states: the way in, the panel in each shape it takes, and the chips the
/// window carries when a connection has gone bad.
///
/// Its own file rather than more arms on the catalog's switch, which had outgrown one — a list of
/// states reads as a list only while it fits on a screen. The split is by subject and not by size:
/// these are the states of getting and keeping a connection, and the switch above is everything a
/// Session is rendered as.
///
/// Every case of the catalog is named, the ones drawn elsewhere included. A `default` here would
/// compile the next Connect-flow case into silently rendering the panel.
extension SpecimenScreen {
    @ViewBuilder var connectFlow: some View {
        switch specimen {
        case .welcome:
            // The first thing a new user sees, and the one screen here that asks for nothing. What
            // it has to settle is that three promises read as promises rather than as a feature
            // grid, and that nothing on it needs a tier explained first.
            centred { WelcomeScreen(start: {}) }
        case .connectionStale, .connectionsStale, .connectionNeedsReconnect:
            // One chip per level a connection fails at: a provider waited out, two rolled up to a
            // count, and a grant that needs obtaining again — named, and with the one act on it.
            centred { connectionChips }
        // One panel per state it can be in: nothing set, a folder alone, half connected, both
        // ports on two identities, a grant mid-flight, a refusal, a Binding that came undone, and
        // the same panel re-entered as Settings.
        case .connectFresh, .connectFolderOnly, .connectPartly, .connectWired, .connectWaiting,
             .connectRefused, .connectBroken, .projectSettings:
            centred { ConnectPanel(reading: connectReading, actions: .inert) }
        // Drawn by the catalog's own switch. Named rather than defaulted, so the day one of them
        // belongs to this flow the compiler is what says so.
        case .foundations, .contract, .sessionRows, .ghostedRows, .roster, .churningRoster,
             .archivedRoster, .openArchivedRoster, .spawningRoster, .renamedRoster, .editingRow,
             .toolbarScope,
             .emptyToolbarScope, .projectDrawer, .unreachableProjectDrawer, .emptyProjectDrawer,
             .openProjectDrawer, .deck, .sessionsDeck, .deckCanopy, .flatDeckCanopy, .agentsFanOut,
             .sessionHeader,
             .externalSessionHeader,
             .orphanedSessionHeader, .longBranchSessionHeader, .contextOk, .contextWarn,
             .contextCrit, .contextUnknown, .contextGuide, .handoffWithheld, .handoffAtWarn,
             .handoffAtCrit, .handoffOnReadOnly, .handoffOnOrphaned, .handedOffReading,
             .sessionSpend, .sessionSpendUnreported, .feed, .feedCalls, .feedNarration,
             .feedCommands, .feedCommandFold, .feedProse, .feedMarkdown, .feedEvidence,
             .feedRunEvidence, .feedSurveyEvidence, .feedSurveyEvidenceStep,
             .feedDocumentEvidence, .evidenceAddresses,
             .feedAttention, .feedPunctuation, .feedPermissionExpired, .feedAgents, .feedAtScale,
             .feedAtScaleEvidence, .feedArriving, .feedWorking, .feedCallInFlight,
             .feedWorkingStill, .feedCallInFlightStill,
             .feedWorkingAged, .feedWorkingCooled, .feedCallInFlightCooled, .emptyFeed,
             .startingSpawn,
             .feedGallery, .feedSingleShot,
             .feedAbsentShot, .feedLightbox, .planPill, .openPlanPill, .unstartedPlanPill,
             .floatingControls, .flatFloatingControls, .feedLeftBehind, .feedLeftBehindInSilence,
             .twoReadings, .composer, .composerTyping, .composerRefusal, .flatComposer,
             .composerStanding, .composerCeiling, .composerDraftKept, .composerQueued,
             .composerRunning, .composerStopped,
             .composerAttached, .composerPasted, .composerDragOver, .composerNoAttach,
             .composerModeNearly, .composerModeUnknown, .composerExternal, .composerOrphaned,
             .composerEnded,
             .permission, .permissionEdit, .permissionStanding, .flatPermission:
            EmptyView()
        }
    }
}
