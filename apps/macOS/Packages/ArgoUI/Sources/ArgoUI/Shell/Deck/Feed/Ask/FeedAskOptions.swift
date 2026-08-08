import SwiftUI

/// The options a question offered, one per line, in the order they were offered.
///
/// Stacked rather than run across the row, because that is the shape they were put in: a prompt
/// offers a numbered list to choose from, and a row of chips that wrapped at some window widths and
/// not others would be a different question at every deck size. Nothing here is pressable — the
/// feed is a reading, and the place to answer is the session's own terminal.
struct FeedAskOptions: View {
    let options: [String]
    /// The one the answer named, where it named one. Every other option goes quiet around it, and
    /// where the answer named none they all stay exactly as they were offered.
    let chosen: String?
    let ink: ArgoColor

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(options, id: \.self) { option in
                FeedAskOption(label: option, isChosen: option == chosen, ink: ink)
            }
        }
    }
}

/// One option, drawn as it was offered.
private struct FeedAskOption: View {
    @Environment(\.argo) private var argo

    let label: String
    let isChosen: Bool
    let ink: ArgoColor

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            mark
            Text(label)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(isChosen ? argo.color.text.primary : ink)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(isChosen ? "\(label), chosen" : label)
    }

    /// The chosen option is marked; the rest hold the column with an empty one, so a list of
    /// options sets its words on a single vertical whichever of them was taken.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoIconSize.inline.rawValue, height: ArgoIconSize.inline.rawValue)
            .overlay {
                if isChosen {
                    ArgoGlyph(ArgoSymbol.chosen, .inline)
                        .foregroundStyle(argo.color.text.primary)
                }
            }
    }
}

#Preview("Ask options — offered, and the one that was taken") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        FeedAskOptions(
            options: ["The attention ink", "The ordinary ink"],
            chosen: nil,
            ink: ArgoTheme.graphite.color.state.attention,
        )
        FeedAskOptions(
            options: ["The attention ink", "The ordinary ink"],
            chosen: "The ordinary ink",
            ink: ArgoTheme.graphite.color.text.secondary,
        )
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 420)
    .argoDeckSurface()
    .argoAppearance()
}
