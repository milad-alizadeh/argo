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
    /// How this question is closed — and, once it has been, that nothing under it is pressable.
    let closing: FeedAskHeld.Closing
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
        // Everything under a closed question is history: a correction would be a second answer to
        // a question already answered, and a card that still presses is the affordance that lies
        // (#1664). `disabled` over the stack rather than a flag per row — each row reads it out of
        // the environment, which is what an unpressable control IS on this platform.
        .disabled(isHeld)
    }

    private var isHeld: Bool {
        closing == .held
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

    /// What closes the act, per `FeedAskHeld.Closing` — the field while the question is open, and
    /// the line that says it is answered once `Answer` has been pressed.
    @ViewBuilder private var answer: some View {
        switch closing {
        case .click:
            EmptyView()
        case let .field(canSend):
            FeedAskAnswerRow(
                text: $held.other,
                placeholder: offers.isEmpty ? "Type your answer" : "Anything else",
                canSend: canSend,
                send: send,
            )
        case .held:
            FeedAskHeldRow()
        }
    }
}

/// What stands where the field stood once `Answer` closed the question: that it is answered, and
/// why nothing has gone yet (#1664).
///
/// DIRECT — Argo is holding these words itself, which is exactly why the card can say so before
/// any record has.
///
/// At the field's own height, and that is load-bearing: `FeedShapeHeight.held(_:across:)` works
/// the card's height out of `FeedAsk` alone and cannot see what a row is holding, so a taller line
/// here would be clipped by the row it is drawn in. It also means the card does not jump under the
/// press that closes it.
private struct FeedAskHeldRow: View {
    @Environment(\.argo) private var argo

    var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            ArgoGlyph(ArgoSymbol.chosen, .inline)
                .foregroundStyle(argo.color.state.attention)
            Text(Self.words)
                .argoLine(ArgoTypography.rowMeta, .metadata)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(height: ArgoComposerVessel.decisionHeight, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Answered. The reply is held until every question is answered.")
    }

    /// One `AskUserQuestion` is one thing the agent waits on, so the card has to say that this
    /// question is done AND that the reply has not gone — either half alone reads as the other.
    private static let words = "answered · held until every question is answered"
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
