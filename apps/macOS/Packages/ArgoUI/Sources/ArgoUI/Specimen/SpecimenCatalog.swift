/// The named states the render harness can put on screen, one per launch.
///
/// `#Preview` is the story (`swift-style.md`), but only Xcode can draw one. This catalog addresses
/// the same states by a name the command line can pass, so a state can be rendered to a PNG without
/// a human driving the app into it — impossible for most of them, since the app launched against an
/// ordinary checkout shows no Sessions.
///
/// Add a case here and it is renderable; `scripts/specimens.sh` parses the list out of this file.
/// What each case DRAWS is `SpecimenScreen`'s — kept separate so this file holds only the list.
public enum Specimen: String, CaseIterable, Sendable {
    case foundations
    case contract
    case sessionRows
    case ghostedRows
    case roster
    case churningRoster
    // No swiped-row case: `.swipeActions` opens only from a real gesture, so there is no state to
    // hand the harness. It is an XCUITest claim (`ArgoE2ETests`), not a PNG.
    case archivedRoster
    case openArchivedRoster
    case spawningRoster
    case renamedRoster
    case editingRow
    case toolbarScope
    case emptyToolbarScope
    case projectDrawer
    case unreachableProjectDrawer
    case emptyProjectDrawer
    case openProjectDrawer
    case deck
    case sessionsDeck
    case sessionHeader
    case externalSessionHeader
    case orphanedSessionHeader
    case longBranchSessionHeader
    case contextOk
    case contextWarn
    case contextCrit
    case contextUnknown
    case contextGuide
    case handoffWithheld
    case handoffAtWarn
    case handoffAtCrit
    case handoffOnReadOnly
    case handoffOnOrphaned
    case handedOffReading
    case sessionSpend
    case sessionSpendUnreported
    case feed
    case feedCalls
    case feedNarration
    case feedCommands
    case feedCommandFold
    case feedProse
    case feedMarkdown
    case feedEvidence
    case feedRunEvidence
    case feedSurveyEvidence
    case feedSurveyEvidenceStep
    case feedDocumentEvidence
    case evidenceAddresses
    case feedAttention
    case feedPunctuation
    case feedPermissionExpired
    case feedAgents
    case feedAtScale
    case feedAtScaleEvidence
    case feedArriving
    case feedWorking
    case feedCallInFlight
    case emptyFeed
    case startingSpawn
    case feedGallery
    case feedSingleShot
    case feedAbsentShot
    case feedLightbox
    case planPill
    case openPlanPill
    case unstartedPlanPill
    case floatingControls
    case flatFloatingControls
    case feedLeftBehind
    case feedLeftBehindInSilence
    case twoReadings
    case composer
    case composerTyping
    case composerCeiling
    case composerDraftKept
    case composerQueued
    case composerRunning
    case composerStopped
    case composerRefusal
    case flatComposer
    case composerStanding
    case composerAttached
    case composerPasted
    case composerDragOver
    case composerNoAttach
    case composerModeNearly
    case composerModeUnknown
    case permission
    case permissionEdit
    case permissionStanding
    case flatPermission
    case welcome
    case connectFresh
    case connectFolderOnly
    case connectPartly
    case connectWired
    case connectWaiting
    case connectRefused
    case connectBroken
    case projectSettings
    case connectionStale
    case connectionsStale
    case connectionNeedsReconnect
}
