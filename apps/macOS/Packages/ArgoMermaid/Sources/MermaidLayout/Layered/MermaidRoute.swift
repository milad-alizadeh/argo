import Foundation

/// One edge, routed: what it draws, where a word written on it would go, and how it meets the box
/// at each of its ends.
///
/// The word's place is TWO facts, not one. The middle of the route says where, and the way the line
/// runs there says which side is off it — and a word placed without the second sits on the stroke
/// wherever the line happens to turn.
struct MermaidRoute: Sendable {
    let figures: [MermaidFigure]
    let mid: CGPoint
    /// A unit vector along the route at its middle.
    let run: CGPoint
    /// Where the line meets the box it left, and where it meets the box it arrives at.
    let tail: End
    let head: End

    /// One end of a route: the face it meets, and the way it runs there. Enough for a reader to
    /// draw its own terminal mark and to write a word against it without knowing the route at all.
    struct End: Equatable, Sendable {
        /// The point on the box's own face, whatever the stroke was trimmed back to.
        let at: CGPoint
        /// A unit vector along the line, pointing AT the box.
        let run: CGPoint

        /// A point `back` up the line from the face.
        func back(_ back: CGFloat) -> CGPoint {
            CGPoint(x: at.x - run.x * back, y: at.y - run.y * back)
        }

        /// A unit vector square to the line, which is the way a mark stands across it.
        var across: CGPoint {
            CGPoint(x: -run.y, y: run.x)
        }
    }
}
