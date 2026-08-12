import SwiftUI

/// The reading itself, at rest: every kind of row, the evidence panel over them, and the lane
/// beside them. What the feed does while a Turn is RUNNING is `SpecimenRegistry+Live.swift`.
extension SpecimenRegistry {
    static let feed: [SpecimenEntry] = rows + evidence + shots + lane

    private static let rows: [SpecimenEntry] = [
        SpecimenEntry("feed") {
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewRows,
                showing: PlanShowing(plan: PlanProjection.previewReading),
            )
        },
        SpecimenEntry("feedCalls") { SpecimenScene.sessions(FeedProjection.previewCallRows) },
        // The tense clash is deliberate: `Ran` above `List open issues` is Argo's voice above the
        // agent's, kept rather than fixed.
        SpecimenEntry("feedNarration") {
            SpecimenScene.sessions(FeedProjection.previewNarratedRows)
        },
        // Render narrow as well as wide — a row's whole promise is that it stays one line.
        SpecimenEntry("feedCommands") { SpecimenScene.sessions(FeedProjection.previewCommandRows) },
        SpecimenEntry("feedCommandFold") { SpecimenScene.sessions(FeedProjection.previewFoldRows) },
        SpecimenEntry("feedProse") { SpecimenScene.sessions(FeedProjection.previewProseRows) },
        SpecimenEntry("feedMarkdown") { MarkdownSpecimen() },
        SpecimenEntry("feedAttention") { SpecimenScene.sessions(FeedProjection.previewAskRows) },
        SpecimenEntry("feedPunctuation") { SpecimenScene.sessions(FeedProjection.previewMarkRows) },
        // The same marks as `feedPunctuation`, with the refusal nobody made among them (#573).
        SpecimenEntry("feedPermissionExpired") {
            SpecimenScene.sessions(FeedProjection.previewExpiredMarkRows)
        },
        SpecimenEntry("feedAgents") {
            AgentsRail(agents: FeedAgents.all(in: FeedProjection.previewRows))
                .frame(width: ArgoLayout.agentsRailWidth)
                .argoDeckSurface()
        },
        // The one state in which the rail scrolls at all, held at the end of its own scroll so
        // two chips pass under the chrome bar — every transcript fixture delegates too few.
        SpecimenEntry("agentsFanOut") { AgentsFanOutSpecimen() },
        // A session at the length a real one reaches. Render narrow too (`ARGO_WINDOW_SIZE`).
        SpecimenEntry("feedAtScale") { SpecimenScene.sessions(FeedProjection.longRows) },
        // A row arriving at the end must not move the row somebody is looking at.
        SpecimenEntry("feedArriving") { ArrivingFeedSpecimen() },
        SpecimenEntry("emptyFeed") { SpecimenScene.sessions([]) },
    ]

    private static let evidence: [SpecimenEntry] = [
        // Call rows, not the whole feed: against the full transcript this failure is below the
        // fold.
        SpecimenEntry("feedEvidence") {
            SpecimenScene.sessions(
                FeedProjection.previewCallRows,
                open: FeedProjection.previewFailedCallID,
            )
        },
        SpecimenEntry("feedRunEvidence") {
            SpecimenScene.sessions(
                FeedProjection.previewCallRows,
                open: FeedProjection.previewRunCallID,
            )
        },
        // One pane twice: at the top, and after a click on the THIRD name under the row.
        SpecimenEntry("feedSurveyEvidence") { SpecimenScene.survey() },
        SpecimenEntry("feedSurveyEvidenceStep") { SpecimenScene.survey(at: 2) },
        // A markdown file the agent wrote: it opens as the DOCUMENT and not as the patch.
        SpecimenEntry("feedDocumentEvidence") {
            SpecimenScene.sessions(
                FeedProjection.previewCallRows,
                open: FeedProjection.previewDocumentCallID,
            )
        },
        // At the panel's floor: command and path cut at OPPOSITE ends, and a three-line header has
        // not moved the close control.
        SpecimenEntry("evidenceAddresses") { EvidenceSpecimen() },
        // The narrowest deck met in practice: two columns sharing 680 points.
        SpecimenEntry("feedAtScaleEvidence") {
            SpecimenScene.sessions(FeedProjection.longRows, open: FeedProjection.longFailedCallID)
        },
    ]

    private static let shots: [SpecimenEntry] = [
        SpecimenEntry("feedGallery") {
            InstrumentDeckShell(room: .sessions, feed: FeedProjection.previewCallRows)
        },
        SpecimenEntry("feedSingleShot") {
            SpecimenScene.sessions(FeedProjection.previewSingleShotRows)
        },
        SpecimenEntry("feedAbsentShot") {
            SpecimenScene.sessions(FeedProjection.previewAbsentShotRows)
        },
        // Reachable only by clicking a thumbnail; the lightbox takes focus so Escape reaches it.
        SpecimenEntry("feedLightbox") {
            SpecimenScene.sessions(
                FeedProjection.previewCallRows,
                lit: FeedProjection.previewShots.first,
            )
        },
    ]

    /// Where the reading LANDS, and the lane that says so. The lane in the whole deck is
    /// `feedAtScale`, and empty is `emptyFeed`.
    private static let lane: [SpecimenEntry] = [
        SpecimenEntry("feedLeftBehind") {
            SpecimenScene.sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        },
        SpecimenEntry("feedLeftBehindInSilence") {
            SpecimenScene.sessions(
                FeedProjection.longSilentRows,
                held: FeedProjection.longHeldRowID,
            )
        },
        // A session at the length a real one reaches, following the end: the rectangle is at the
        // foot of the lane and the marks above it are the whole transcript.
        SpecimenEntry("minimapLane") { SpecimenScene.overview(FeedProjection.longRows) },
        // The reader partway up the same session. What this settles is the one thing a still can
        // settle about a scrub: that the rectangle stands where the reading actually is.
        SpecimenEntry("minimapLaneHeld") {
            SpecimenScene.overview(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        },
        // Nothing to scroll. The lane draws the reading at its own size rather than stretching
        // three rows to fill it, which would read as a session ten times the length.
        SpecimenEntry("minimapLaneShortReading") {
            SpecimenScene.overview(Array(FeedProjection.previewRows.prefix(3)))
        },
    ]
}
