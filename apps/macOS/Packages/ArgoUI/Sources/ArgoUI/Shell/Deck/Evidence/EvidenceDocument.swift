import SwiftUI

/// A markdown file in the panel, drawn with the shape its markup asked for rather than as a listing
/// of its characters.
///
/// `FeedMarkdown` and nothing of its own: the fences are highlighted by the machinery agent prose
/// already uses, and a block Argo cannot read is drawn exactly as it arrived. Nothing here adds,
/// reorders or summarises anything — the notation is the only thing that stops being drawn, and the
/// characters themselves stay one control away (`EvidenceReading`).
struct EvidenceDocument: View {
    /// The file's own characters, with any gutter the host wrote already taken off.
    let text: String

    var body: some View {
        FeedMarkdown(text: text)
            .textSelection(.enabled)
            .padding(.horizontal, ArgoSpacing.comfortable)
            .accessibilityLabel("Document")
    }
}

#Preview("Evidence document — a SKILL.md as the reader wants to read it") {
    EvidenceDocument(text: """
    # Implement

    One ticket at a time, **test-first** at the seams that were agreed.

    - Run the gates as you go.
    - Run the whole suite once at the end.
    """)
    .frame(width: 460, height: 240)
    .background(ArgoPalette.graphite.surface.sunken)
    .argoAppearance()
}
