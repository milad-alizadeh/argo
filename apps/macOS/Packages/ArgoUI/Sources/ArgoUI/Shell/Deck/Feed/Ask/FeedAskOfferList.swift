import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The options of one waiting question, as the cards you press — and, under them, `Other…` and
/// whatever field the question needs.
///
/// Indented to 24, which is `markerWidth` + `markerGap`: the cards hang under the question's words
/// rather than under its mark.
struct FeedAskOfferList: View {
    let question: Ask.Question
    let offers: [FeedAskOffer]
    @Binding var held: FeedAskHeld.Marks
    /// Whether this question closes with an `Answer` of its own, rather than on a click.
    let needsClosing: Bool
    let hasSomethingToSend: Bool
    /// Take one option. On a one-of question this IS the answer; on a many-of it ticks a box.
    let pick: (Int) -> Void
    let send: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
            ForEach(offers) { offer in
                FeedAskOfferRow(
                    offer: offer,
                    isMultiple: question.allowsMultiple,
                    isTicked: held.ordinals.contains(offer.ordinal),
                    press: { pick(offer.ordinal) },
                )
            }
            other
            answer
        }
        .padding(.leading, ArgoFeedRow.markerWidth + ArgoFeedRow.markerGap)
    }

    /// `Other…` carries NO number: the feed numbers only what was offered, so a numbered one would
    /// put the ordinals one past the ones the answer names.
    ///
    /// Only on a one-of question with options. A many-of question's field is already open beside
    /// its boxes, and a free-form question is nothing but the field.
    @ViewBuilder private var other: some View {
        if !offers.isEmpty, !question.allowsMultiple, !held.isOtherOpen {
            FeedAskOtherRow { held.isOtherOpen = true }
        }
    }

    @ViewBuilder private var answer: some View {
        if needsClosing {
            FeedAskAnswerRow(
                text: $held.other,
                placeholder: offers.isEmpty ? "Type your answer" : "Anything else",
                canSend: hasSomethingToSend,
                send: send,
            )
        }
    }
}

/// The way out of the options offered — pressing it swaps the pick for a field.
private struct FeedAskOtherRow: View {
    @Environment(\.argo) private var argo

    let open: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: open) {
            Text("Other…")
                .argoText(ArgoFeedRow.proseRung)
                .foregroundStyle(argo.color.text.tertiary)
                // The number's column stays empty, so `Other` sets its words on the same vertical
                // the numbered options do without carrying an ordinal of its own. The card's own
                // horizontal padding is part of that distance, which is why all three are named.
                .padding(
                    .leading,
                    ArgoSpacing.comfortable + ArgoFeedRow.markerWidth + ArgoFeedRow.markerGap,
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, ArgoSpacing.base)
                .padding(.trailing, ArgoSpacing.comfortable)
                .feedAskCard(isHovered: isHovered)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .argoAnimation(.selection, value: isHovered)
        .accessibilityLabel("Other, answer in your own words")
    }
}
