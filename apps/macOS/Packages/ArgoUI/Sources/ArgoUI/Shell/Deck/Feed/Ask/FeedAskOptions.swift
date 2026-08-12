import SwiftUI

/// The options a question offered, one per line, in the order they were offered.
///
/// Drawn as the numbered list it was put as: stacked, on the feed's own marker grid, at the feed's
/// own prose rung. A row of chips that wrapped at some window widths and not others would be a
/// different question at every deck size, and options set smaller than the question read as a note
/// about the row rather than the thing being chosen between. Nothing here is pressable — the feed
/// is a reading, and the place to answer is the session's own terminal.
struct FeedAskOptions: View {
    let offers: [FeedAskOffer]

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(offers) { offer in
                FeedAskOption(offer: offer, isQuiet: quiets(offer))
            }
        }
    }

    /// An option steps back only when another one was taken. Where the answer named none — the
    /// state that matters — they all stay exactly as they were offered.
    private func quiets(_ offer: FeedAskOffer) -> Bool {
        !offer.isChosen && offers.contains { $0.isChosen }
    }
}

/// One option, drawn as it was offered: its number, then its words.
private struct FeedAskOption: View {
    @Environment(\.argo) private var argo

    let offer: FeedAskOffer
    let isQuiet: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
            mark
            Text(offer.label)
                .argoText(ArgoTypography.body)
                .foregroundStyle(isQuiet ? argo.color.text.secondary : argo.color.text.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(offer.isChosen ? "\(offer.label), chosen" : offer.label)
    }

    /// The number the option was offered under, and the mark instead of it once it was taken. One
    /// column either way, so the words set on a single vertical whichever option was chosen — the
    /// same column a numbered list in the prose above is drawn in.
    @ViewBuilder private var mark: some View {
        if offer.isChosen {
            ArgoGlyph(ArgoSymbol.chosen, .inline)
                .foregroundStyle(argo.color.text.primary)
                .frame(width: ArgoFeedRow.markerWidth, alignment: .trailing)
        } else {
            Text(offer.marker)
                .argoText(ArgoTypography.body)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoFeedRow.markerWidth, alignment: .trailing)
        }
    }
}

#Preview("Ask options — offered, and the one that was taken") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        FeedAskOptions(offers: FeedAskOptionsPreview.offers(chosen: nil))
        FeedAskOptions(offers: FeedAskOptionsPreview.offers(chosen: "The ordinary ink"))
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 420)
    .argoDeckSurface()
    .argoAppearance()
}

private enum FeedAskOptionsPreview {
    static func offers(chosen: String?) -> [FeedAskOffer] {
        ["The attention ink", "The ordinary ink"].enumerated().map { index, label in
            FeedAskOffer(ordinal: index + 1, label: label, isChosen: label == chosen)
        }
    }
}
