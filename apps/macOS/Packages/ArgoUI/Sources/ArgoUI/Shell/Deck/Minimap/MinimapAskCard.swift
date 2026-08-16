import Foundation

/// A question as the lane needs it: what was asked, and what was offered under it.
///
/// The one row the lane used to draw as a solid slab of the loudest colour the app has. The feed
/// draws a bordered card with a wash and words inside it, and a band matched neither its shape nor
/// its weight — it read as a wall where the reading has a question.
struct MinimapAskCard: Equatable, Sendable {
    /// One option, as the row sets it: its number in the marker column, then its words.
    struct Offer: Equatable, Sendable {
        var marker: String
        var label: String
    }

    /// One question and the options offered under it, in the order they were offered.
    struct Question: Equatable, Sendable {
        var text: String
        var offers: [Offer]
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

    /// One question and its options on ONE grid, which is what `FeedAskQuestion` draws: the ask
    /// glyph takes the same marker column the option numbers do, so the options need no indent of
    /// their own.
    @MainActor private static func asked(
        _ question: MinimapAskCard.Question,
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (marks: [MinimapRowMark], height: CGFloat) {
        let asked = line(question.text, marked: nil, ink: ink, across: measure)
        guard !question.offers.isEmpty else { return (asked.marks, asked.height) }
        var marks = asked.marks
        var y = asked.height + ArgoFeedRow.stepBeforeProse
        for offer in question.offers {
            let drawn = line(offer.label, marked: offer.marker, ink: ink, across: measure)
            marks += drawn.marks.map { $0.lowered(by: y) }
            y += drawn.height + ArgoFeedRow.askOptionGap
        }
        return (marks, max(asked.height, y - ArgoFeedRow.askOptionGap))
    }

    /// One line of the card: its mark in the marker column, and its words on the vertical after it.
    ///
    /// `marked` is the option's number, or `nil` for the question — whose glyph fills the column
    /// rather than measuring, since a glyph is not text the lane can size.
    @MainActor private static func line(
        _ text: String,
        marked: String?,
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (marks: [MinimapRowMark], height: CGFloat) {
        let indent = ArgoFeedRow.markerWidth + ArgoFeedRow.markerGap
        let width = marked.map { min(ArgoFeedRow.markerWidth, ProseMetrics.width(of: $0)) }
            ?? ArgoFeedRow.markerWidth
        let marker = MinimapRowMark(
            y: 0,
            height: ProseFace.body.lineBox,
            from: ArgoFeedRow.markerWidth - width,
            to: ArgoFeedRow.markerWidth,
            ink: ink,
        )
        let words = MinimapProseWords(text: text).laid(ink: ink, across: measure - indent)
        return ([marker] + words.marks.map { $0.indented(by: indent) }, words.height)
    }
}
