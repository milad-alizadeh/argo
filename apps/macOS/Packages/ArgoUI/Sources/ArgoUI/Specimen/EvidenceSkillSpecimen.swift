import ArgoEngine
import SwiftUI

/// Both readings of one `SKILL.md`, side by side: the document the panel opens on, and the source
/// the control flips to.
///
/// Side by side because the pair is what is being looked at (#736). The document alone says nothing
/// about whether the file's own language survived — that is the half where the notation is back and
/// has to be under its grammar — and the source alone says nothing about the notation going away.
/// Neither line is numbered in either: Argo read this file itself, and the host gave it no gutter.
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
        EvidenceOutput(output: Self.body, language: .markdown, reading: reading)
            .frame(width: ArgoLayout.evidencePanelMinimumWidth, alignment: .topLeading)
            .padding(.vertical, ArgoSpacing.base)
    }

    /// The shipping fixture's own skill, read the way the panel reads it — DERIVED, since the file
    /// was read off the machine rather than owned by Argo (`CONTEXT.md` L2).
    private static let body = OutputEvidence(
        tier: .derived,
        text: CockpitPresentation.Session.previewSkillLoad.body?.text ?? "",
    )
}

#Preview("Evidence — a SKILL.md as the document, and as its source") {
    EvidenceSkillSpecimen()
        .frame(height: 320)
        .argoAppearance()
}
