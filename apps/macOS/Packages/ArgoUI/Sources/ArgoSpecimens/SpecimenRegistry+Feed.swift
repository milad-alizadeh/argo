import ArgoDesign
import ArgoUI
import SwiftUI

/// The reading itself, at rest: every kind of row, and the evidence panel over them. What the feed
/// does while a Turn is RUNNING is `SpecimenRegistry+Live.swift`, the minimap beside it is
/// `SpecimenRegistry+Lane.swift`, and the question rows are `SpecimenRegistry+Ask.swift`.
extension SpecimenRegistry {
    static let feed: [SpecimenEntry] = rows + asks + diagrams + evidence + shots + lane

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
        // A Turn's work folded across its own narration (#1172): the two cards at rest, then the
        // card of commands opened onto the list its failure is tinted in.
        SpecimenEntry("feedWorkFold") {
            SpecimenScene.sessions(FeedProjection.previewDenseTurnRows)
        },
        SpecimenEntry("feedWorkFoldOpen") {
            SpecimenScene.sessions(
                FeedProjection.previewDenseTurnRows,
                open: FeedProjection.previewFailedWorkRowID,
            )
        },
        // The list an open fold puts out, in the four states the pointer and the panel put it in
        // (#1228) — none of which a still of the reading reaches.
        SpecimenEntry("feedFoldNames") { FeedFoldNamesSpecimen() },
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
        // A body naming a picture (#1412). The FIRST address is reachable and the second is not,
        // so one render carries both answers: the picture drawn at the gallery's own box, and the
        // alt text standing in for the one nothing could read.
        SpecimenEntry("feedMarkdownPicture") {
            MarkdownSpecimen(text: MarkdownSpecimen.pictures)
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
            AgentsRail(agents: FeedAgents.all(in: FeedProjection.previewRows, of: .running))
                .frame(width: ArgoAgentsRail.width)
                .argoDeckSurface()
        },
        // The one state in which the rail scrolls at all, held at the end of its own scroll so
        // two chips pass under the chrome bar — every transcript fixture delegates too few.
        SpecimenEntry("agentsFanOut") { AgentsFanOutSpecimen() },
        // The same twenty, collapsed. Twenty dots fit a column twenty names overflow, which is the
        // whole argument for the strip.
        SpecimenEntry("agentsFanOutCollapsed") { AgentsFanOutSpecimen(isCollapsed: true) },
        // The disclosure's other side: the finished Agents back in the column beside the live ones
        // (#1090), which is the only state the rail holds every delegation at once.
        SpecimenEntry("agentsFanOutRevealed") { AgentsFanOutSpecimen(showingFinished: true) },
        // The three below are rendered BESIDE the feed on the whole deck, because what they have to
        // settle is the seam and the hierarchy rather than the rail's own insides.
        SpecimenEntry("agentsRailSole") { AgentsRailSpecimen(subject: .sole) },
        // The selected chip's legibility and the re-scoped feed in one still — the two claims the
        // discarded attempt satisfied in prose and failed in pixels (#378).
        SpecimenEntry("agentsRailScoped") { AgentsRailSpecimen(subject: .scoped) },
        // The same reading arrived at by the CLICK rather than opened on: the state #1012 lives in,
        // and the one nothing rendered until now (#1003's "Not covered").
        SpecimenEntry("agentsRailRescoped") { AgentsRailSpecimen(subject: .rescoped) },
        SpecimenEntry("agentsRailQuiet") { AgentsRailSpecimen(subject: .quiet) },
        // A running Session holding yesterday's delegations — the lie #1089 could not reach, and
        // the disclosure the finished ones now sit behind (#1090).
        SpecimenEntry("agentsRailStale") { AgentsRailSpecimen(subject: .stale) },
        // An idle parent waiting on its fan-out, two chips running off the children's own
        // records and one unknown (#1269).
        SpecimenEntry("agentsRailWaiting") { AgentsRailSpecimen(subject: .waiting) },
        SpecimenEntry("agentsRailCollapsed") { AgentsRailSpecimen(subject: .collapsed) },
        // Collapsed AND scoped: the one state where the way back out of a Subagent could still go
        // missing, since the strip has no room for the word Main (#1013).
        SpecimenEntry("agentsRailCollapsedScoped") {
            AgentsRailSpecimen(subject: .collapsedScoped)
        },
        // A session at the length a real one reaches. Render narrow too (`ARGO_WINDOW_SIZE`).
        SpecimenEntry("feedAtScale") { SpecimenScene.sessions(FeedProjection.longRows) },
        // Rows that say the same words as each other, which is the state a height store keyed on
        // what a row says draws on top of itself (#1100).
        SpecimenEntry("feedRepeatedRows") { SpecimenScene.sessions(FeedProjection.repeatedRows) },
        // A row arriving at the end must not move the row somebody is looking at.
        SpecimenEntry("feedArriving") { ArrivingFeedSpecimen() },
        SpecimenEntry("emptyFeed") { SpecimenScene.sessions([]) },
        // The same empty reading over a CLI that has not spoken yet: the pair is the claim, one
        // saying nothing has been said and the other saying why. The reading is UNTOUCHED and the
        // plinth at the foot is where the wait is said (`cockpit-feed-waiting.md`).
        SpecimenEntry("startingFeed") {
            SpecimenScene.sessions([]).environment(\.argoFeedWait, .starting)
        },
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
        // a call. It is drawn inside the bubble where the prompt carried words too, and as a
        // gallery across the measure where it carried none.
        SpecimenEntry("feedPastedShots") {
            SpecimenScene.sessions(FeedProjection.previewPastedRows)
        },
        // The run the fold is for: six pictures pasted one after another, as one wrapping grid
        // rather than a column of one thumbnail per row (#1252).
        SpecimenEntry("feedPastedRun") {
            SpecimenScene.sessions(FeedProjection.previewPastedRunRows)
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
}
