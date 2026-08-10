import SwiftUI

/// A fenced block: the agent's characters, on a ground, at the machine role — under the grammar
/// the agent named, where it named one Argo can read.
///
/// The language comes from the info string and nowhere else. That is what makes the colours a
/// reading of the record rather than a guess about it: the agent wrote ```` ```swift ````, and a
/// fence with no info, or one naming something unknown, is drawn exactly as it arrived. Same
/// theme as the evidence panel's, because a reader looking at Swift twice in one window should
/// not be reading two dialects of it.
struct FeedMarkdownFence: View {
    @Environment(\.argo) private var argo

    let code: String
    let info: String?

    /// The block under the grammar. `nil` until the highlighter answers and `nil` again if it
    /// cannot — the characters are on screen from the first frame either way.
    @State private var coloured: AttributedString?

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            if let info {
                Text(info)
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            words
                .argoMono(.body)
                .textSelection(.enabled)
                .lineSpacing(ArgoFeedRow.machineLineSpacing)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ArgoSpacing.base)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.control))
        // Keyed on the characters, not on the language: SwiftUI matches a block view by its
        // position, and two fences of one language would otherwise share the first one's colours.
        .task(id: code) { await colour() }
    }

    @ViewBuilder private var words: some View {
        if let coloured {
            Text(coloured)
        } else {
            Text(code).foregroundStyle(argo.color.text.secondary)
        }
    }

    private var language: EvidenceLanguage? {
        info.flatMap(EvidenceLanguage.init(declared:))
    }

    private func colour() async {
        guard let language else {
            coloured = nil
            return
        }
        coloured = await SyntaxHighlight.block(code, in: language, colors: SyntaxTheme.colors)
    }
}

#Preview("Feed fence — a grammar the agent named, and one Argo cannot read") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.blockStep) {
        FeedMarkdownFence(code: """
        public static let inset: CGFloat = ArgoSpacing.section
        // The measure is typographic, not a rung of the ladder.
        """, info: "swift")
        FeedMarkdownFence(code: "graph TD\n  A --> B", info: "mermaid")
        FeedMarkdownFence(code: "Read 2 files · Ran 5", info: nil)
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 620)
    .argoDeckSurface()
    .argoAppearance()
}
