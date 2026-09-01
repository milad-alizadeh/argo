import Foundation

/// One Turn named on the lane (#382): the stretch its block covers, and the words it opened with.
///
/// Lane space, not miniature space: the annotation layer does not slide, so these are resolved
/// against where the miniature currently sits.
///
/// `words` is `nil` where there is nothing to say — a promptless exchange, or a label with no room.
/// The Ion Blue line is drawn either way.
struct MinimapAnnotation: Equatable {
    let span: ClosedRange<CGFloat>
    let words: String?
}

extension MinimapAnnotation {
    /// Where the words sit: at the head of the block, held inside the lane. A Turn running off the
    /// top still has to say what it is, and one at the foot has to stay on screen to be read.
    @MainActor func labelY(inside laneHeight: CGFloat) -> CGFloat {
        let floor = max(0, laneHeight - ArgoMinimapLane.labelHeight)
        return min(max(0, span.lowerBound), floor)
    }

    /// The same annotations with the WORDS dropped from any label that would land on the one above
    /// it — two labels drawn on top of each other are neither. Only under ⇧⌘, where every Turn
    /// asks to be named at once.
    ///
    /// The line always survives, because it says a Turn is THERE, which stays true whether or not
    /// there is room to say what it asked. Compared on where each label actually lands, clamp
    /// included: past the foot of the lane every head resolves to the same line.
    @MainActor static func legible(
        _ annotations: [MinimapAnnotation],
        inside laneHeight: CGFloat,
    )
        -> [MinimapAnnotation] {
        var lastLabel: CGFloat?
        return annotations.reduce(into: []) { kept, annotation in
            let y = annotation.labelY(inside: laneHeight)
            let crowded = lastLabel.map { y - $0 < ArgoMinimapLane.labelHeight } ?? false
            guard annotation.words != nil, !crowded else {
                return kept.append(MinimapAnnotation(span: annotation.span, words: nil))
            }
            lastLabel = y
            kept.append(annotation)
        }
    }
}
