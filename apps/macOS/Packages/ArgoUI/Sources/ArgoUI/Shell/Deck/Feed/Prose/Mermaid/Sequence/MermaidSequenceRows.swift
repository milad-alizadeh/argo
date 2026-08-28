import Foundation

/// Where each event of a sequence diagram stands DOWN it: the band it owns, top to bottom.
///
/// A sequence diagram's vertical extent is its event count and nothing else — there is no ranking
/// and no ordering pass, because the source already stated the order. Every event takes the room it
/// needs and the next one starts under it.
@MainActor
struct MermaidSequenceRows {
    /// One per event, in event order.
    let tops: [CGFloat]
    let heights: [CGFloat]
    /// Where the lifelines start, and where they end.
    let head: CGFloat
    let foot: CGFloat

    static func of(_ diagram: MermaidSequence, under head: CGFloat) -> MermaidSequenceRows {
        let heights = diagram.events.map(height(of:))
        var tops: [CGFloat] = []
        var y = head + MermaidMeasure.lifelineTail
        for height in heights {
            tops.append(y)
            y += height
        }
        return MermaidSequenceRows(
            tops: tops,
            heights: heights,
            head: head,
            foot: y + MermaidMeasure.lifelineTail,
        )
    }

    func top(at event: Int) -> CGFloat {
        tops.indices.contains(event) ? tops[event] : foot
    }

    func bottom(at event: Int) -> CGFloat {
        heights.indices.contains(event) ? top(at: event) + heights[event] : foot
    }

    /// Where a message's own line is drawn in its band: UNDER its word. The word is set above the
    /// line rather than on it, because a connector drawn through its own caption reads as neither.
    func line(at event: Int, under words: CGFloat) -> CGFloat {
        top(at: event) + words + MermaidMeasure.messageDrop
    }

    /// How deep one event's band runs. An `activate` takes none: it says when a bar starts and
    /// nothing happens on the page at that moment.
    private static func height(of event: MermaidSequence.Event) -> CGFloat {
        switch event {
        case let .message(message):
            let base = words(of: message.text) + MermaidMeasure.messageDrop
                + MermaidMeasure.messageGap
            // A self-message drops out of its lifeline and back, so its band is deeper by the drop.
            return message.from == message.to ? base + MermaidMeasure.loopDrop : base
        case .note:
            return ceil(MermaidMeasure.edgeFace.lineBox) + MermaidMeasure.nodeInsetY * 2
                + MermaidMeasure.messageGap
        case .activate, .deactivate:
            return 0
        case .opens, .divides:
            return ceil(MermaidMeasure.groupFace.lineBox) + MermaidMeasure.groupInset
        case .closes:
            return MermaidMeasure.groupInset
        }
    }

    /// How tall a message's word stands. Nothing at all where it says nothing, so a wordless
    /// message costs no room.
    static func words(of text: String) -> CGFloat {
        text.isEmpty ? 0 : ceil(MermaidMeasure.edgeFace.lineBox)
    }
}
