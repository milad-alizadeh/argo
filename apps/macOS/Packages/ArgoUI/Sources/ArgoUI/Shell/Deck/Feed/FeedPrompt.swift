import SwiftUI

/// What was asked, as a bubble on the trailing edge.
///
/// The one row in the feed that is not the agent speaking, so it is the one row drawn as an
/// object rather than as prose on the ground — a reader scrolling a long session finds where each
/// turn began by shape alone. Steering typed mid-run lands here too: a steer is a prompt.
struct FeedPrompt: View {
    @Environment(\.argo) private var argo

    let text: String

    @State private var isExpanded = false
    /// What the prompt is worth folded and unfolded. Both are measured rather than estimated,
    /// because whether a prompt is long is a question about the column it landed in, not about
    /// how many characters it has.
    @State private var foldedHeight: CGFloat = 0
    @State private var wholeHeight: CGFloat = 0

    var body: some View {
        VStack(alignment: .trailing, spacing: ArgoSpacing.snug) {
            Text("You")
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
            bubble
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    /// Whether anything is actually hidden. A control offering to unfold a prompt that is already
    /// whole is a claim there is more to read.
    private var isFolded: Bool {
        wholeHeight > foldedHeight + ArgoStroke.border
    }

    private var bubble: some View {
        VStack(alignment: .trailing, spacing: ArgoSpacing.snug) {
            prose(lineLimit: isExpanded ? nil : ArgoFeedRow.collapsedPromptLines)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(alignment: .top) { rulers }
            if isFolded {
                disclosure
            }
        }
        .padding(.vertical, ArgoSpacing.comfortable)
        .padding(.horizontal, ArgoSpacing.loose)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.popover))
        // Proposed to the bubble, so the text wraps inside it: the frame sizes to the content
        // when the prompt is short, and holds it at the measure when it is not.
        .frame(maxWidth: ArgoFeedRow.bubbleMeasure, alignment: .trailing)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("You asked: \(text)")
    }

    /// The two copies the fold is decided by, drawn behind the visible one at exactly its width
    /// and never seen. Measuring the visible copy instead would answer with whatever state it is
    /// currently in, which is the state being asked about.
    private var rulers: some View {
        ZStack {
            ruler(lineLimit: ArgoFeedRow.collapsedPromptLines) { foldedHeight = $0 }
            ruler(lineLimit: nil) { wholeHeight = $0 }
        }
        .hidden()
        .accessibilityHidden(true)
    }

    private func ruler(
        lineLimit: Int?,
        report: @escaping (CGFloat) -> Void,
    )
        -> some View {
        prose(lineLimit: lineLimit)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { report($0) }
    }

    private var disclosure: some View {
        Button(isExpanded ? "Show less" : "Show more") { isExpanded.toggle() }
            .buttonStyle(.plain)
            .argoText(ArgoTypography.caption)
            .foregroundStyle(argo.color.text.tertiary)
    }

    private func prose(lineLimit: Int?) -> some View {
        Text(text)
            .argoText(ArgoTypography.body)
            .lineSpacing(ArgoFeedRow.proseLineSpacing)
            .lineLimit(lineLimit)
            .fixedSize(horizontal: false, vertical: true)
    }
}

#Preview("Feed prompt — short enough to stand whole") {
    FeedPrompt(text: "Run the visual contract suite and tell me what broke.")
        .padding(ArgoFeedRow.inset)
        .frame(width: 720)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed prompt — long enough to fold") {
    FeedPrompt(text: String(
        repeating: "Read the whole anatomy study before you start. ",
        count: 14,
    ))
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — at the narrowest feed column") {
    FeedPrompt(text: String(repeating: "Fold me. ", count: 40))
        .padding(ArgoFeedRow.inset)
        .frame(width: 360)
        .argoDeckSurface()
        .argoAppearance()
}
