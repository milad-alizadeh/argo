import Foundation

/// How big one mindmap node stands: its own words at the face its DEPTH sets, plus the room the
/// figure around them needs.
///
/// Measured with the very prose metrics the paragraphs around the diagram are measured with, so a
/// map sets at the feed's rhythm rather than floating at a scale of its own.
@MainActor
enum MermaidMindmapBox {
    static func size(of node: MermaidMindmap.Node, atDepth depth: Int) -> CGSize {
        let face = MermaidMindmap.face(atDepth: depth)
        // Every line separately: a run measured whole reports the two lines' width side by side.
        let lines = node.text.components(separatedBy: "\n")
        let widest = lines.map { ProseMetrics.width(of: $0, in: face) }.max() ?? 0
        let words = CGSize(
            width: max(
                MermaidMeasure.nodeMinWidth, ceil(widest) + MermaidMeasure.nodeInsetX * 2,
            ),
            height: ceil(face.height(ofLines: lines.count)) + MermaidMeasure.nodeInsetY * 2,
        )
        return grown(words, to: node.outline)
    }

    /// The words' box widened to whatever the figure around them needs. A label inscribed in a
    /// round or a pointed silhouette only fits the box it was measured into if that box is bigger
    /// than the words.
    private static func grown(_ words: CGSize, to outline: MermaidOutline) -> CGSize {
        switch outline {
        case .ellipse:
            let side = max(words.width, words.height)
            return CGSize(width: side, height: side)
        case .bang, .cloud:
            let scale = MermaidMeasure.blobScale
            return CGSize(width: ceil(words.width * scale), height: ceil(words.height * scale))
        case .hexagon, .flag:
            return CGSize(width: words.width + MermaidMeasure.flagPoint * 2, height: words.height)
        case .rect, .rounded, .capsule, .subroutine, .diamond, .cylinder, .enclosure:
            return words
        }
    }
}
