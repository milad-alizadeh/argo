import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The options a question offered, one per line, numbered, in the order they were offered — the
/// PENDING reading, and only that one (#1207); a settled question draws `FeedAskAnswer` instead.
///
/// Drawn on the feed's own marker grid, at the feed's own prose rung — the same shape a numbered
/// list in the prose above takes, because that is the shape the prompt put them in. Nothing here is
/// pressable: the feed is a reading, and the place to answer is the session's own terminal.
struct FeedAskOptions: View {
    let offers: [FeedAskOffer]

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.askOptionGap) {
            ForEach(offers) { offer in
                FeedAskOption(offer: offer, isQuiet: anyChosen && !offer.isChosen)
            }
        }
    }

    /// An option steps back only when another one was taken. Where the answer named none — the
    /// state that matters — they all stay exactly as they were offered.
    private var anyChosen: Bool {
        offers.contains(where: \.isChosen)
    }
}

/// One option, drawn as it was offered: its number, its words, and the mark where it was taken.
private struct FeedAskOption: View {
    @Environment(\.argo) private var argo

    let offer: FeedAskOffer
    let isQuiet: Bool

    /// The mark TRAILS the words rather than taking a column of its own, so the number the answer
    /// names an option by survives being chosen and the words keep one vertical either way.
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
            FeedMarker(text: offer.marker)
            Text(offer.label)
                .argoText(ArgoFeedRow.proseRung)
                .foregroundStyle(isQuiet ? argo.color.text.secondary : argo.color.text.primary)
                .fixedSize(horizontal: false, vertical: true)
            if offer.isChosen {
                ArgoGlyph(ArgoSymbol.chosen, .inline)
                    .foregroundStyle(argo.color.text.primary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
    }

    /// Spoken with its number, because the number is how the answer names an option.
    private var spoken: String {
        let said = "\(offer.ordinal). \(offer.label)"
        return offer.isChosen ? "\(said), chosen" : said
    }
}

#Preview("Ask options — offered, and the one that was taken") {
    let options = Ask.Option.labelled(["The attention ink", "The ordinary ink"])
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        FeedAskOptions(offers: FeedAskOffer.numbered(options, chosen: nil))
        FeedAskOptions(offers: FeedAskOffer.numbered(options, chosen: "The ordinary ink"))
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 420)
    .argoDeckSurface()
    .argoAppearance()
}
