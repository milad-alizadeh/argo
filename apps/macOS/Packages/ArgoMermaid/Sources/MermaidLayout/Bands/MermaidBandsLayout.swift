import Foundation

// ONE layout for both types #866 names, because a journey and a timeline are the same picture.
// What a journey adds is a rating on a column; what a timeline adds is nothing at all.

extension MermaidBands {
    var laid: MermaidPlan {
        let metrics = MermaidBandsMetrics(bands: self)
        let marks = MermaidBandsMarks(metrics)
        return MermaidPlan(
            figures: marks.figures,
            captions: marks.captions,
            size: CGSize(width: metrics.width, height: metrics.height),
        ).normalised
    }
}
