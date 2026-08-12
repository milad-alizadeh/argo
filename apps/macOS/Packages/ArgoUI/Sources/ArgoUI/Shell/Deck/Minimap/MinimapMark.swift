import Foundation

/// One row's place in the lane: where it starts, counted down from the top, and how tall it is
/// drawn. What a mark LOOKS like is #382's.
struct MinimapMark: Equatable {
    let y: CGFloat
    let height: CGFloat
}
