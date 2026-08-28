import SwiftUI

/// A fenced block: the agent's characters, on a ground, at the machine role — under the grammar
/// the agent named, where it named one Argo can read.
///
/// The language comes from the info string and nowhere else, so the colours are a reading of the
/// record rather than a guess: a fence with no info, or one naming something unknown, is drawn
/// exactly as it arrived. Same theme as the evidence panel's.
struct FeedMarkdownFence: View {
    @Environment(\.argo) private var argo

    let code: String
    let info: String?

    var body: some View {
        SyntaxColoured(.block(code: code, under: language)) { colouring in
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                if let info {
                    Text(info)
                        .argoText(ArgoTypography.sectionLabel)
                        .foregroundStyle(argo.color.text.tertiary)
                }
                // A fence's lines are the record's, so they break where the writer broke them. Left
                // to wrap they fold at whatever the pane is left, which turns an aligned block —
                // a pipe table, a diff, a column of values — into prose that reads as garbage.
                // `fixedSize` horizontally is what refuses the fold; the scroll view is what makes
                // the overflow reachable rather than clipped.
                ScrollView(.horizontal) {
                    words(colouring.whole)
                        .argoMono(.body)
                        .textSelection(.enabled)
                        .lineSpacing(ArgoFeedRow.machineLineSpacing)
                        .fixedSize(horizontal: true, vertical: true)
                }
                .scrollIndicators(.automatic, axes: .horizontal)
            }
            .padding(ArgoSpacing.base)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.control))
        }
    }

    @ViewBuilder private func words(_ coloured: AttributedString?) -> some View {
        if let coloured {
            Text(coloured)
        } else {
            Text(code).foregroundStyle(argo.color.text.secondary)
        }
    }

    private var language: EvidenceLanguage? {
        info.flatMap(EvidenceLanguage.init(declared:))
    }
}

#Preview("Feed fence — a grammar the agent named, and one Argo cannot read") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.blockStep) {
        FeedMarkdownFence(code: """
        public static let inset: CGFloat = ArgoSpacing.section
        // The measure is typographic, not a rung of the ladder.
        """, info: "swift")
        // A diagram type nothing can read yet. One Argo CAN read is no longer a fence at all —
        // `MarkdownBlock` makes it a `.diagram` before this view ever sees it.
        FeedMarkdownFence(
            code: "pie title Where the time went\n  \"Reading\" : 40",
            info: "mermaid",
        )
        FeedMarkdownFence(code: "Read 2 files · Ran 5", info: nil)
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 620)
    .argoDeckSurface()
    .argoAppearance()
}
