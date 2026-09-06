import ArgoUI
import SwiftUI

/// The evidence panel over the feed, in each state a Tool Call's Result can be read in. Split from
/// `SpecimenRegistry+Feed.swift` because that file's own stills grew past its length; the group is
/// unchanged, and `feed` still composes it.
extension SpecimenRegistry {
    static let evidence: [SpecimenEntry] = [
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
}
