import SwiftUI

/// A mark, drawn as a rule with its words let into it.
///
/// The only hairlines in the feed are here. A rule under an ordinary row is a box being drawn round
/// something that is already a paragraph in a column; a rule ACROSS the column says the reading
/// changed shape at this point, which is the one thing these three rows have in common.
///
/// The words are machine type for the same reason: they are the record talking about itself — a
/// stop reason is the host's own word, and a token count is a number — not the agent talking.
struct FeedMarkLine: View {
    @Environment(\.argo) private var argo

    let mark: FeedMark

    var body: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            rule
            Text(mark.words)
                .argoText(ArgoTypography.machineCaption)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .fixedSize()
            rule
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(mark.words)
    }

    private var rule: some View {
        Rectangle()
            .fill(argo.color.edge.hairline)
            .frame(height: ArgoStroke.hairline)
    }
}

#Preview("Marks — every one the preview transcript punctuates its reading with") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        ForEach(Array(FeedProjection.previewMarks.enumerated()), id: \.offset) { _, mark in
            FeedMarkLine(mark: mark)
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

// A stop reason outside the vocabulary reads `unknown` rather than the nearest guess, and that is
// the one mark a real transcript is least likely to carry — so it gets a render of its own.
#Preview("Marks — a turn that ended for a reason nothing could read") {
    FeedMarkLine(mark: .turnEnded(.unknown))
        .padding(ArgoFeedRow.inset)
        .frame(width: 720)
        .argoDeckSurface()
        .argoAppearance()
}
