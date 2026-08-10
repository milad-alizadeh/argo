/// The named states the render harness can put on screen, one per launch.
///
/// `#Preview` is the story (`swift-style.md`), but Xcode is the only thing that can draw one, and a
/// screenshot is the only evidence a visual claim can be checked against. This catalog addresses
/// the same states by a name the command line can pass, so a state can be rendered to a PNG without
/// a human driving the app into it — which for most of them is not possible at all, since the app
/// launched against an ordinary checkout shows no Sessions.
///
/// Add a case here and it is renderable; `scripts/specimens.sh` reads the list out of this file
/// rather than repeating it. What each case DRAWS is `SpecimenScreen`'s — the list and the wiring
/// are separate files because the script parses this one, and a parser is a reason for a file to
/// hold one thing.
public enum Specimen: String, CaseIterable, Sendable {
    case foundations
    case contract
    case sessionRows
    case ghostedRows
    case roster
    case churningRoster
    case swipedRow
    case archivedRoster
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
    case feedDocumentEvidence
    case evidenceAddresses
    case feedAttention
    case feedPunctuation
    case feedAgents
    case feedAtScale
    case feedAtScaleEvidence
    case feedArriving
    case emptyFeed
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
}
