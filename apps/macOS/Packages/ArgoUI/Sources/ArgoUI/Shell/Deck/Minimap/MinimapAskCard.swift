import Foundation
import ProseText

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

    /// One question and what stands under it, which is never two things at once (#1207).
    struct Question: Equatable, Sendable {
        /// What the lane lays under the question, matching what the feed's row draws under it.
        enum Under: Equatable, Sendable {
            /// The options as they were offered, numbered — a waiting or pending question.
            case offered([Offer])
            /// The answer's words, where the record has settled it. Carried without a marker: the
            /// row puts a GLYPH in that column, and a glyph is not text the lane can size.
            case answered(String)
            /// A question that offered nothing, and one settled with nothing readable.
            case nothing
        }

        var text: String
        var under: Under
    }

    var questions: [Question]
    /// The line the card carries UNDER its questions, where it carries one — the caption a row
    /// drawn off the companion plugin says its channel in (#1205). `nil` for every row Argo owns.
    ///
    /// Here rather than left to the row, because a lane that drew a CONVENTION card exactly as it
    /// draws a DIRECT one is the false DIRECT the row itself is built to avoid — and because the
    /// card is laid out inside a frame of the ROW's height, so a line the lane does not draw is a
    /// line of empty space inside it.
    var caption: String?
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
        -> [MinimapRowRect] {
        let inset = card.isRuled ? ArgoFeedRow.askCardInset : 0
        let inside = measure - inset * 2
        guard inside > 0 else { return [] }
        var rects = card.isRuled
            ? [MinimapRowRect(
                y: 0, height: height, from: 0, to: measure, ink: card.ink, shape: .frame,
            )]
            : []
        var y = inset
        for question in card.questions {
            let laid = asked(question, ink: card.ink, across: inside)
            rects += laid.rects.map { $0.lowered(by: y).indented(by: inset) }
            y += laid.height + ArgoFeedRow.blockStep
        }
        guard let caption = card.caption else { return rects }
        // At the quietest prose ink and never the card's own: the caption is meta about where the
        // question came from, and drawn in the attention colour it would read as more of the ask.
        let said = line(caption, marker: nil, ink: .thought, across: inside)
        return rects + said.rects.map { $0.lowered(by: y).indented(by: inset) }
    }

    /// One question and its options on ONE grid, which is what `FeedAskQuestion` draws: the ask
    /// glyph takes the same marker column the option numbers do, so the options need no indent of
    /// their own.
    @MainActor private static func asked(
        _ question: MinimapAskCard.Question,
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (rects: [MinimapRowRect], height: CGFloat) {
        let asked = line(question.text, marker: nil, ink: ink, across: measure)
        switch question.under {
        case .nothing:
            return (asked.rects, asked.height)
        case let .answered(answer):
            let y = asked.height + ArgoFeedRow.stepBeforeProse
            let drawn = line(answer, marker: nil, ink: ink, across: measure)
            return (asked.rects + drawn.rects.map { $0.lowered(by: y) }, y + drawn.height)
        case let .offered(offers):
            var rects = asked.rects
            var y = asked.height + ArgoFeedRow.stepBeforeProse
            for offer in offers {
                let drawn = line(offer.label, marker: offer.marker, ink: ink, across: measure)
                rects += drawn.rects.map { $0.lowered(by: y) }
                y += drawn.height + ArgoFeedRow.askOptionGap
            }
            return (rects, max(asked.height, y - ArgoFeedRow.askOptionGap))
        }
    }

    /// One line of the card: its rect in the marker column, and its words on the vertical after it.
    ///
    /// `marker` is the option's number, or `nil` for the question — whose glyph fills the column
    /// rather than measuring, since a glyph is not text the lane can size.
    @MainActor private static func line(
        _ text: String,
        marker: String?,
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (rects: [MinimapRowRect], height: CGFloat) {
        let indent = ArgoFeedRow.markerWidth + ArgoFeedRow.markerGap
        let width = marker.map { min(ArgoFeedRow.markerWidth, ProseMetrics.width(of: $0)) }
            ?? ArgoFeedRow.markerWidth
        let markerRect = MinimapRowRect(
            y: 0,
            height: ProseFace.body.lineBox,
            from: ArgoFeedRow.markerWidth - width,
            to: ArgoFeedRow.markerWidth,
            ink: ink,
        )
        let words = MinimapProseWords(text: text).laid(ink: ink, across: measure - indent)
        return ([markerRect] + words.rects.map { $0.indented(by: indent) }, words.height)
    }
}
