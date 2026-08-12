import Foundation

/// One Turn as the lane draws it: where its block stands in the miniature, and the words it opened
/// with (#382).
///
/// The block is the unit a reader recognises — one thing asked, and everything that happened
/// because of it. An Ion Blue line spans it, and a hover over it says what was asked.
struct MinimapBlock: Equatable {
    let y: CGFloat
    let height: CGFloat
    /// `nil` for a promptless exchange. The line still spans it: something happened here, and a
    /// block the lane refused to draw would read as a gap in the session.
    let prompt: String?

    var range: ClosedRange<CGFloat> {
        y ... y + height
    }
}
