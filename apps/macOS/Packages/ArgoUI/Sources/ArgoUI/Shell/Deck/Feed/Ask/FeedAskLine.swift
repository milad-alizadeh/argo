import ArgoEngine
import SwiftUI

/// A question put to somebody, drawn where it was asked.
///
/// The one attention-coloured thing in the feed, and only while it is WAITING. An answered question
/// goes neutral: it is history, and history that goes on glowing is what teaches a reader that the
/// colour means nothing. Neither state moves — a question is a moment in the reading, and a row
/// pinned to the top of the feed is a row lying about when it happened.
struct FeedAskLine: View {
    @Environment(\.argo) private var argo

    let ask: FeedAsk

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.blockStep) {
            ForEach(Array(ask.questions.enumerated()), id: \.offset) { _, question in
                FeedAskQuestion(question: question, chosen: ask.chosen(in: question), ink: ink)
            }
        }
        .padding(ArgoSpacing.comfortable)
        .background(ground, in: RoundedRectangle(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(edge, lineWidth: ArgoStroke.border)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(ask.isPending ? "Question, waiting on you" : "Question, answered")
    }

    /// The attention role while it waits, and the ordinary ink once it is settled.
    private var ink: ArgoColor {
        ask.isPending
            ? ArgoOperationalState.attention.tint(in: argo.color)
            : argo.color.text.secondary
    }

    /// A wash rather than a fill: the row still has to read as part of the column it interrupts.
    private var ground: ArgoColor {
        ask.isPending ? ArgoOperationalState.attention.ground(in: argo.color) : .transparent
    }

    /// Only while it waits. A settled question keeps no rule around it: the feed's hairlines are
    /// its punctuation, and a box drawn round an ordinary row is a border competing with the three
    /// marks that are supposed to be the only lines in the column.
    private var edge: ArgoColor {
        ask.isPending ? ink : .transparent
    }
}

/// One question and the options it offered.
private struct FeedAskQuestion: View {
    @Environment(\.argo) private var argo

    let question: Ask.Question
    /// Which option the answer named, where it named one.
    let chosen: String?
    let ink: ArgoColor

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.stepBeforeProse) {
            HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
                ArgoGlyph(ArgoSymbol.asked, .inline)
                    .foregroundStyle(ink)
                Text(question.text)
                    .argoText(ArgoTypography.body)
                    .foregroundStyle(argo.color.text.primary)
            }
            options
        }
    }

    /// The options exactly as they were offered, in the order they were offered. A question that
    /// offered none draws none — free-form asks exist, and two invented buttons would be worse
    /// than the honest absence.
    @ViewBuilder private var options: some View {
        if !question.options.isEmpty {
            FeedAskOptions(options: question.options, chosen: chosen, ink: ink)
                .padding(.leading, ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap)
        }
    }
}

#Preview("Ask — waiting on you, and the same feed's question once it is settled") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        ForEach(Array(FeedProjection.previewAsks.enumerated()), id: \.offset) { _, ask in
            FeedAskLine(ask: ask)
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

// A question that offered nothing to choose between. Free-form asks exist, and the row has a branch
// for one — so it gets a render, or the branch is a state nobody has looked at.
#Preview("Ask — a question with no options under it") {
    FeedAskLine(ask: FeedAsk(
        ask: Ask(questions: [Ask.Question(text: "What should I call the roll-up?", options: [])]),
        isAnswered: false,
        answer: nil,
    ))
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
