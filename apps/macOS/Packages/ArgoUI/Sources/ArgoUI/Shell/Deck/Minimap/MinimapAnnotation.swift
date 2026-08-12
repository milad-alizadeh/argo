import Foundation

/// One Turn named on the lane (#382): the stretch its block covers, and the words it opened with.
///
/// Lane space, not miniature space — annotations are drawn on the layer that does not slide, so
/// they are resolved against where the miniature currently sits and nowhere else.
///
/// `words` is `nil` for a promptless exchange. The Ion Blue line is still drawn: something happened
/// there, and a Turn the lane refused to mark would read as a gap in the session.
struct MinimapAnnotation: Equatable {
    let span: ClosedRange<CGFloat>
    let words: String?
}

extension MinimapAnnotation {
    /// The annotations that fit, head to foot. Two labels drawn on top of each other are neither,
    /// so one closer than a label's height to the one above it is dropped rather than stacked —
    /// which only happens under ⇧⌘, where every Turn asks to be named at once.
    static func legible(_ annotations: [MinimapAnnotation]) -> [MinimapAnnotation] {
        annotations.reduce(into: []) { kept, annotation in
            guard let last = kept.last else { return kept.append(annotation) }
            let apart = annotation.span.lowerBound - last.span.lowerBound
            guard apart >= ArgoMinimapLane.labelHeight else { return }
            kept.append(annotation)
        }
    }
}
