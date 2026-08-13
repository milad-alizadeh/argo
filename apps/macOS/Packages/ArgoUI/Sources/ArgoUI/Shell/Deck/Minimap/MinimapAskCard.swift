import Foundation

/// A question as the lane needs it: what was asked, and what was offered under it.
///
/// The one row the lane used to draw as a solid slab of the loudest colour the app has. The feed
/// draws a bordered card with a wash and words inside it, and a band matched neither its shape nor
/// its weight — it read as a wall where the reading has a question.
struct MinimapAskCard: Equatable, Sendable {
    /// One question and the labels offered under it, in the order they were offered.
    struct Question: Equatable, Sendable {
        var text: String
        var options: [String]
    }

    var questions: [Question]
    var ink: FeedInk
    /// Whether the card keeps a rule around it. Only while it waits: a settled question keeps none
    /// in the feed, and a lane still drawing one would say a reader was needed where none is.
    ///
    /// Its own field rather than read off the ink, because a lane that inferred the state from the
    /// colour is exactly what D25 forbids.
    var isRuled: Bool
}

extension MinimapRowShape {
    /// The card's own frame with the words inside it — the shape `FeedAskLine` draws.
    ///
    /// The frame keeps the full measure whatever the words do, so a question is still the one thing
    /// in the lane found by shape alone with the colour taken away, which is D25's rule. What
    /// changed is that it is a container with content rather than a fill.
    @MainActor static func card(_ card: MinimapAskCard, across measure: CGFloat, height: CGFloat)
        -> [MinimapRowMark] {
        let inset = ArgoFeedRow.askCardInset
        let inside = measure - inset * 2
        guard inside > 0 else { return [] }
        var marks = card.isRuled
            ? [MinimapRowMark(
                y: 0, height: height, from: 0, to: measure, ink: card.ink, shape: .frame,
            )]
            : []
        var y = inset
        for question in card.questions {
            let laid = asked(question, ink: card.ink, across: inside)
            marks += laid.marks.map { $0.lowered(by: y).indented(by: inset) }
            y += laid.height + ArgoFeedRow.blockStep
        }
        return marks
    }

    /// One question: its mark in the same column a call's opens in, its words beside it, and the
    /// options stacked under them on the words' own vertical.
    @MainActor private static func asked(
        _ question: MinimapAskCard.Question,
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (marks: [MinimapRowMark], height: CGFloat) {
        let indent = ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap
        let asked = MinimapProseWords(text: question.text)
            .laid(ink: ink, across: measure - indent)
        var marks = [MinimapRowMark(
            y: 0, height: ProseFace.body.lineBox, from: 0, to: ArgoFeedRow.callSymbolWidth,
            ink: ink,
        )]
        marks += asked.marks.map { $0.indented(by: indent) }
        guard !question.options.isEmpty else { return (marks, asked.height) }
        let offered = options(question.options, ink: ink, across: measure - indent)
        let y = asked.height + ArgoFeedRow.stepBeforeProse
        marks += offered.marks.map { $0.lowered(by: y).indented(by: indent) }
        return (marks, y + offered.height)
    }

    /// The options, one line apiece and each as wide as its own label — stacked rather than run
    /// across, because that is the shape they were offered in.
    @MainActor private static func options(
        _ labels: [String],
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (marks: [MinimapRowMark], height: CGFloat) {
        let face = ProseFace(rung: ArgoTypography.caption.rung)
        let step = face.lineBox + ArgoFeedRow.askOptionGap
        let indent = ArgoIconSize.inline.rawValue + ArgoSpacing.snug
        let marks = labels.enumerated().map { at, label in
            MinimapRowMark(
                y: CGFloat(at) * step,
                height: face.lineBox,
                from: indent,
                to: min(measure, indent + ProseMetrics.width(of: label, in: face)),
                ink: ink,
            )
        }
        return (marks, CGFloat(labels.count) * step - ArgoFeedRow.askOptionGap)
    }
}
