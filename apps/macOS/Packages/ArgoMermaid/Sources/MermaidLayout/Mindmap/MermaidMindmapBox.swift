import Foundation

/// How big one mindmap node stands: its own words at the face its DEPTH sets, plus the room the
/// figure around them needs.
///
/// The words themselves are `MermaidWords`, which every diagram type measures through — a mindmap
/// and a flowchart set the same label at the same size or the feed has two rhythms in it.
enum MermaidMindmapBox {
    static func size(of node: MermaidMindmap.Node, atDepth depth: Int) -> CGSize {
        grown(
            MermaidWords.box(of: node.text, in: MermaidMindmap.face(atDepth: depth)),
            to: node.outline,
        )
    }

    /// The words' box widened to whatever the figure around them needs. A label inscribed in a
    /// round or a pointed silhouette only fits the box it was measured into if that box is bigger
    /// than the words.
    private static func grown(_ words: CGSize, to outline: MermaidOutline) -> CGSize {
        switch outline {
        case .ellipse:
            return MermaidWords.squared(words)
        case .bang, .cloud:
            // Both ends of the diagonal, because the corners of a rect inscribed in a round
            // silhouette are what leave it first — see `blobScale`.
            let scale = MermaidMeasure.blobScale
            return CGSize(width: ceil(words.width * scale), height: ceil(words.height * scale))
        case .hexagon, .flag:
            return MermaidWords.pointed(words)
        case .rect, .rounded, .capsule, .subroutine, .diamond, .cylinder, .enclosure, .dot,
             .bar:
            return words
        }
    }
}
