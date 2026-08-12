import ArgoEngine
import SwiftUI

/// A question put to somebody, drawn where it was asked. The one attention-coloured thing in the
/// feed, and only while it is WAITING; an answered one goes neutral. Neither state moves.
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

    /// The attention role while it waits, and the ordinary ink once it is settled — read off the
    /// ask itself, which is also where the minimap reads it.
    private var ink: ArgoColor {
        ask.ink.role(in: argo.color)
    }

    /// A wash rather than a fill: the row still has to read as part of the column it interrupts.
    private var ground: ArgoColor {
        ask.isPending ? ArgoOperationalState.attention.ground(in: argo.color) : .transparent
    }

    /// Only while it waits: a settled question keeps no rule around it.
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
    /// offered none draws none — free-form asks exist.
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

// The free-form branch gets a render, or it is a state nobody has looked at.
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
