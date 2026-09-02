import SwiftUI

/// The reading itself, at rest: every kind of row, the evidence panel over them, and the lane
/// beside them. What the feed does while a Turn is RUNNING is `SpecimenRegistry+Live.swift`.
extension SpecimenRegistry {
    static let feed: [SpecimenEntry] = rows + asks + diagrams + evidence + shots + lane

    /// The question while it WAITS — one render per shape a call can put one in (#712), judged
    /// against `docs/designs/feed-ask/`. The settled reading is `feedAttention` above; these are
    /// the states where the row is the thing you press.
    private static let asks: [SpecimenEntry] = [
        SpecimenEntry("feedAskOneOf") { SpecimenScene.sessions(FeedProjection.previewAskOneOf) },
        SpecimenEntry("feedAskManyOf") { SpecimenScene.sessions(FeedProjection.previewAskManyOf) },
        SpecimenEntry("feedAskFreeForm") {
            SpecimenScene.sessions(FeedProjection.previewAskFreeForm)
        },
        SpecimenEntry("feedAskTwoQuestions") {
            SpecimenScene.sessions(FeedProjection.previewAskTwoQuestions)
        },
        // A Session Argo cannot drive draws no affordance at all (#546) — the same question, read.
        SpecimenEntry("feedAskUnavailable") {
            SpecimenScene.sessions(FeedProjection.previewAskUnavailable)
        },
        // The state between the two: driveable, but the gate is not holding this question — Argo
        // restarted under a CLI that still is. No cards, and the attention ground STAYS, because
        // it is genuinely still waiting.
        SpecimenEntry("feedAskUnreached") {
            SpecimenScene.sessions(FeedProjection.previewAskUnreached)
        },
    ]

    private static let rows: [SpecimenEntry] = [
        SpecimenEntry("feed") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
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
        // The two states of one long prompt (#946). Rendered at the feed's own measure: the fold is
        // a question about the column the bubble landed in, so a still taken at any other width
        // settles nothing about it.
        SpecimenEntry("feedPromptFolded") { SpecimenScene.longPrompt(unfolded: false) },
        SpecimenEntry("feedPromptUnfolded") { SpecimenScene.longPrompt(unfolded: true) },
        SpecimenEntry("feedMarkdown") { MarkdownSpecimen() },
        // A table whose cells are mostly backticked. Render narrow as well as wide
        // (`ARGO_WINDOW_SIZE`): what it settles is that a row is placed at the height the mono
        // draws it at, so the row under it is not drawn over its last line (#766).
        SpecimenEntry("feedMarkdownCodeTable") {
            MarkdownSpecimen(text: MarkdownSpecimen.codeDenseTable)
        },
        SpecimenEntry("feedAttention") { SpecimenScene.sessions(FeedProjection.previewAskRows) },
        SpecimenEntry("feedPunctuation") { SpecimenScene.sessions(FeedProjection.previewMarkRows) },
        // The design's own render (#688): the command the user typed, their line verbatim, and the
        // marker under it — no expanded prompt anywhere.
        SpecimenEntry("feedSkillLoaded") {
            SpecimenScene.sessions(FeedProjection.previewSkillLoadedTurn)
        },
        // The three states that marker has, together: the body Argo read, the file it could not,
        // and the one with nothing behind it — which draws no chevron at all.
        SpecimenEntry("feedSkillLoadedStates") {
            SpecimenScene.sessions(FeedProjection.previewSkillLoadRows)
        },
        // The same marks as `feedPunctuation`, with the refusal nobody made among them (#573).
        SpecimenEntry("feedPermissionExpired") {
            SpecimenScene.sessions(FeedProjection.previewExpiredMarkRows)
        },
        SpecimenEntry("feedAgents") {
            AgentsRail(agents: FeedAgents.all(in: FeedProjection.previewRows))
                .frame(width: ArgoAgentsRail.width)
                .argoDeckSurface()
        },
        // The one state in which the rail scrolls at all, held at the end of its own scroll so
        // two chips pass under the chrome bar — every transcript fixture delegates too few.
        SpecimenEntry("agentsFanOut") { AgentsFanOutSpecimen() },
        // The same twenty, collapsed. Twenty dots fit a column twenty names overflow, which is the
        // whole argument for the strip.
        SpecimenEntry("agentsFanOutCollapsed") { AgentsFanOutSpecimen(isCollapsed: true) },
        // The three below are rendered BESIDE the feed on the whole deck, because what they have to
        // settle is the seam and the hierarchy rather than the rail's own insides.
        SpecimenEntry("agentsRailSole") { AgentsRailSpecimen(subject: .sole) },
        // The selected chip's legibility and the re-scoped feed in one still — the two claims the
        // discarded attempt satisfied in prose and failed in pixels (#378).
        SpecimenEntry("agentsRailScoped") { AgentsRailSpecimen(subject: .scoped) },
        // The same reading arrived at by the CLICK rather than opened on: the state #1012 lives in,
        // and the one nothing rendered until now (#1003's "Not covered").
        SpecimenEntry("agentsRailRescoped") { AgentsRailSpecimen(subject: .rescoped) },
        SpecimenEntry("agentsRailCollapsed") { AgentsRailSpecimen(subject: .collapsed) },
        // Collapsed AND scoped: the one state where the way back out of a Subagent could still go
        // missing, since the strip has no room for the word Main (#1013).
        SpecimenEntry("agentsRailCollapsedScoped") {
            AgentsRailSpecimen(subject: .collapsedScoped)
        },
        // A session at the length a real one reaches. Render narrow too (`ARGO_WINDOW_SIZE`).
        SpecimenEntry("feedAtScale") { SpecimenScene.sessions(FeedProjection.longRows) },
        // A row arriving at the end must not move the row somebody is looking at.
        SpecimenEntry("feedArriving") { ArrivingFeedSpecimen() },
        SpecimenEntry("emptyFeed") { SpecimenScene.sessions([]) },
        // A record read at its two ends, with the seam where its middle is missing (#404 AC4). The
        // whole deck rather than the rows alone: what the still has to settle is that the rule
        // carries between two turns of ordinary work, and that no spend is rolled up at the foot
        // of a reading that does not have all of it.
        SpecimenEntry("feedExcerpted") {
            SpecimenScene.sessions(FeedProjection.previewExcerptedRows)
        },
        // The keyboard cursor, on the two shapes a row can be: the bubble it has to hug, and the
        // line that fills the measure. Unreachable without an arrow key, so unreachable in a still
        // any other way (#533).
        // The prose-only reading for the bubble: short enough that the row is in view with no
        // scroll at all, which is what makes the still repeatable.
        SpecimenEntry("feedCursorPrompt") {
            cursored(on: FeedProjection.previewPromptID, in: FeedProjection.previewProseRows)
        },
        SpecimenEntry("feedCursorCall") {
            cursored(on: FeedProjection.previewLastFailedCallID, in: FeedProjection.previewRows)
        },
        // The copy chip's lit state (#767). A still cannot hover, so the cursor stands in.
        SpecimenEntry("feedCursorMessage") {
            cursored(on: FeedProjection.previewMessageID, in: FeedProjection.previewProseRows)
        },
    ]

    private static func cursored(on row: FeedRow.ID?, in rows: [FeedRow]) -> some View {
        var reading = FeedPreview(rows: rows)
        reading.cursor = row
        return reading
    }

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
        // The two readings of that body beside each other — the one pair a click is otherwise the
        // only way to reach.
        SpecimenEntry("evidenceSkillReadings") { EvidenceSkillSpecimen() },
        // The marker's panel: the `SKILL.md` body as the document it is, under the path Argo read
        // it from.
        SpecimenEntry("feedSkillEvidence") {
            SpecimenScene.sessions(
                FeedProjection.previewSkillLoadRows,
                open: FeedProjection.previewSkillLoadRowID,
            )
        },
        // The failure the row's ink announces, said in full: which file, and that Argo could not
        // read it. The marker is red either way, so the panel is not the only place it is stated.
        SpecimenEntry("feedSkillUnreadableEvidence") {
            SpecimenScene.sessions(
                FeedProjection.previewSkillLoadRows,
                open: FeedProjection.previewSkillUnreadableRowID,
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
            SpecimenScene.sessions(FeedProjection.previewCallRows)
        },
        SpecimenEntry("feedSingleShot") {
            SpecimenScene.sessions(FeedProjection.previewSingleShotRows)
        },
        // The other way a picture reaches the feed: pasted into a prompt rather than produced by
        // a call, so it is drawn inside the bubble instead of across the measure.
        SpecimenEntry("feedPastedShots") {
            SpecimenScene.sessions(FeedProjection.previewPastedRows)
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
        // The pointer on one Turn. The Ion Blue line spans exactly that block and its prompt is
        // drawn beside the lane — the one state a still cannot reach without being told.
        SpecimenEntry("minimapLaneNamingTurn") {
            SpecimenScene.overview(FeedProjection.longRows, naming: .turn(atShare: 0.4))
        },
        // ⇧⌘. Every Turn on screen named at once, and the ones too close together to be read drawn
        // as a line with no words.
        SpecimenEntry("minimapLaneEveryPrompt") {
            SpecimenScene.overview(FeedProjection.longRows, naming: .everyTurn)
        },
        // A reading with every kind in it, so the vocabulary can be judged in one look: prose,
        // commands, a mutation's two inks, a failure, a run of pictures and a question waiting.
        SpecimenEntry("minimapLaneKinds") { SpecimenScene.overview(FeedProjection.previewRows) },
        // The lane beside markdown: a table drawn as its cells, paragraphs at the widths they
        // wrapped to, and a one-line prompt worth one line of lane.
        SpecimenEntry("minimapLaneMarkdown") {
            SpecimenScene.overview(FeedProjection.previewMarkdownRows)
        },
    ]
}
