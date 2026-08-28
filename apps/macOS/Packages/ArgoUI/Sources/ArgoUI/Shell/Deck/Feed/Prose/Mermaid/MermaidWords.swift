import SwiftUI

/// The room a node's own words take, and what the figure drawn round them adds to it.
///
/// Shared by every diagram type that puts a label in a box. The inset, the floor under a
/// one-letter node and the point a hexagon cuts off its ends are one decision each, and a second
/// reader spelling them itself would be one edit away from a flowchart and a mindmap measuring the
/// same words two ways.
@MainActor
enum MermaidWords {
    /// The label at the feed's own prose metrics, plus the breathing room around it. Whole points,
    /// so the height the lane reports is the height SwiftUI draws rather than a fraction either of
    /// them might round differently.
    ///
    /// Every line measured separately: a run measured whole reports two lines' width side by side.
    static func box(of text: String, in face: ProseFace = .body) -> CGSize {
        let lines = text.components(separatedBy: "\n")
        let widest = lines.map { ProseMetrics.width(of: $0, in: face) }.max() ?? 0
        return CGSize(
            width: max(
                MermaidMeasure.nodeMinWidth, ceil(widest) + MermaidMeasure.nodeInsetX * 2,
            ),
            height: ceil(face.height(ofLines: lines.count)) + MermaidMeasure.nodeInsetY * 2,
        )
    }

    /// The same box widened by what a hexagon and a flag cut off their own ends, so the words clear
    /// the point rather than running into it.
    static func pointed(_ words: CGSize) -> CGSize {
        CGSize(width: words.width + MermaidMeasure.flagPoint * 2, height: words.height)
    }

    /// The same box squared off, which is the only box a circle is ever given.
    static func squared(_ words: CGSize) -> CGSize {
        let side = max(words.width, words.height)
        return CGSize(width: side, height: side)
    }
}
