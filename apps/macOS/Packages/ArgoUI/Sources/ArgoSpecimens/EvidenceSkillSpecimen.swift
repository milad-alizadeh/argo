import ArgoDesign
import ArgoEngine
import ArgoFixtures
import ArgoUI
import SwiftUI

/// Both readings of one `SKILL.md`, side by side: the document the panel opens on, and the source
/// the control flips to.
///
/// Side by side because the PAIR is what is being looked at — the document says nothing about
/// whether the file's language survived, and the source says nothing about the notation going away.
/// Neither is numbered: Argo read this file itself, and no host gave it a gutter.
struct EvidenceSkillSpecimen: View {
    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.flush) {
            reading(.prose)
            DeckSeparator()
            reading(.source)
        }
        .argoDeckSurface()
    }

    /// At the panel's own floor, the width the body is hardest to read at.
    private func reading(_ reading: EvidenceReading) -> some View {
        EvidenceOutput(
            output: Self.skill,
            language: .markdown,
            holdsTheFile: true,
            reading: reading,
        )
        .frame(width: ArgoLayout.evidencePanelMinimumWidth, alignment: .topLeading)
        .padding(.vertical, ArgoSpacing.base)
    }

    /// The shipping fixture's own skill, read the way the panel reads it — DERIVED, since the file
    /// was read off the machine rather than owned by Argo (`CONTEXT.md` L2).
    private static let skill = OutputEvidence(
        tier: .derived,
        text: TranscriptFixtures.previewSkillLoad.body?.text ?? "",
    )
}

#Preview("Evidence — a SKILL.md as the document, and as its source") {
    EvidenceSkillSpecimen()
        .frame(height: 320)
        .argoAppearance()
}
