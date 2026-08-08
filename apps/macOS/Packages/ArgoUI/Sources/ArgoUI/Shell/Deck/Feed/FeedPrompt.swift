import SwiftUI

/// What was asked, as a bubble on the trailing edge.
///
/// The one row in the feed that is not the agent speaking, so it is the one row drawn as an
/// object rather than as prose on the ground — a reader scrolling a long session finds where each
/// turn began by shape alone. Steering typed mid-run lands here too: a steer is a prompt.
///
/// Labelled "Prompt" and not "You": a transcript's prompt carries no author, and a Session read
/// off somebody else's file was not asked for by the person reading it.
struct FeedPrompt: View {
    @Environment(\.argo) private var argo

    let text: String
    /// Held by the feed, not here: a row in a lazy stack is discarded the moment it scrolls out,
    /// and a fold that lived in the row would quietly re-close behind the reader.
    @Binding var isExpanded: Bool

    /// What the prompt is worth folded and unfolded. Both are measured rather than estimated,
    /// because whether a prompt is long is a question about the column it landed in, not about
    /// how many characters it has.
    @State private var foldedHeight: CGFloat = 0
    @State private var wholeHeight: CGFloat = 0

    var body: some View {
        VStack(alignment: .trailing, spacing: ArgoSpacing.snug) {
            Text("Prompt")
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
            bubble
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    /// Whether anything is actually hidden. A control offering to unfold a prompt that is already
    /// whole is a claim there is more to read.
    private var isFolded: Bool {
        wholeHeight > foldedHeight + ArgoFeedRow.foldTolerance
    }

    private var bubble: some View {
        VStack(alignment: .trailing, spacing: ArgoSpacing.snug) {
            prose(lineLimit: isExpanded ? nil : ArgoFeedRow.collapsedPromptLines)
                .textSelection(.enabled)
                .background(alignment: .top) { rulers }
            if isFolded {
                disclosure
            }
        }
        .padding(.vertical, ArgoSpacing.comfortable)
        .padding(.horizontal, ArgoSpacing.loose)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.popover))
        // A ceiling, not a width: the bubble sizes to a short prompt and holds a long one at the
        // measure. Taken off the reading measure rather than off the deck, because a prompt is
        // prose too — the study caps only the agent's side, and a bubble that grew with the window
        // would be the one line in the feed allowed past the measure.
        .frame(maxWidth: ArgoFeedRow.bubbleMeasure, alignment: .trailing)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Prompt: \(text)")
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

    private var disclosure: some View {
        Button(isExpanded ? "Show less" : "Show more") { isExpanded.toggle() }
            .buttonStyle(.plain)
            .argoText(ArgoTypography.caption)
            .foregroundStyle(argo.color.text.tertiary)
    }

    private func ruler(
        lineLimit: Int?,
        report: @escaping (CGFloat) -> Void,
    )
        -> some View {
        prose(lineLimit: lineLimit)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { report($0) }
    }

    private func prose(lineLimit: Int?) -> some View {
        FeedProseText(text: text)
            .lineLimit(lineLimit)
            .fixedSize(horizontal: false, vertical: true)
    }
}

#Preview("Feed prompt — short enough to stand whole") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        text: "Run the visual contract suite and tell me what broke.",
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — long enough to fold") {
    @Previewable @State var isExpanded = false

    FeedPrompt(
        text: String(repeating: "Read the whole anatomy study before you start. ", count: 14),
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — unfolded") {
    @Previewable @State var isExpanded = true

    FeedPrompt(
        text: String(repeating: "Read the whole anatomy study before you start. ", count: 14),
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prompt — at the narrowest feed column") {
    @Previewable @State var isExpanded = false

    FeedPrompt(text: String(repeating: "Fold me. ", count: 40), isExpanded: $isExpanded)
        .padding(ArgoFeedRow.inset)
        .frame(width: 360)
        .argoDeckSurface()
        .argoAppearance()
}
