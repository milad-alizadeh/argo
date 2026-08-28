import Foundation

/// One edge, routed: what it draws, and where a word written on it would go.
///
/// The word's place is TWO facts, not one. The middle of the route says where, and the way the line
/// runs there says which side is off it — and a word placed without the second sits on the stroke
/// wherever the line happens to turn.
struct MermaidRoute: Sendable {
    let figures: [MermaidFigure]
    let mid: CGPoint
    /// A unit vector along the route at its middle.
    let run: CGPoint
}
