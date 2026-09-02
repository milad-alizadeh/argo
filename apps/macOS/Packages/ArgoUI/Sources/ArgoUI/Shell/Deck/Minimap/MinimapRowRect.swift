import Foundation
import ProseText

/// One rectangle a feed row draws, in the ROW's own coordinates: points down from the row's top,
/// and points across from the drawable's leading edge.
///
/// The rows report these and the lane only scales them. That is the whole of #382's second pass:
/// the lane used to be handed a row's measured HEIGHT and re-derive its line count, its line widths
/// and its links from character counts — a second model of the row, which drifted from the first at
/// every row that was not plain body prose set on the line grid.
///
/// Points and not shares, so nothing here needs to know what the lane's width stands for.
struct MinimapRowRect: Equatable, Sendable {
    var y: CGFloat
    var height: CGFloat
    var from: CGFloat
    var to: CGFloat
    var ink: FeedInk
    /// How it is drawn, where the row draws it as something other than its ink's own default — the
    /// card around a question is stroked while the words inside it are filled.
    var shape: FeedInk.Shape?

    var drawn: FeedInk.Shape {
        shape ?? ink.shape
    }

    /// The same rect, `by` points further down. What a block returns is in the block's coordinates;
    /// the row moves it into its own.
    func lowered(by offset: CGFloat) -> MinimapRowRect {
        var moved = self
        moved.y += offset
        return moved
    }

    /// The same rect, `by` points further across.
    func indented(by offset: CGFloat) -> MinimapRowRect {
        var moved = self
        moved.from += offset
        moved.to += offset
        return moved
    }
}

extension MinimapRowRect {
    /// One drawn line of words: its box at the face's own height, running as far as the words got.
    @MainActor static func line(
        _ at: Int,
        width: CGFloat,
        in face: ProseFace,
        ink: FeedInk,
    )
        -> MinimapRowRect {
        MinimapRowRect(
            y: face.y(ofLine: at),
            height: face.lineBox,
            from: 0,
            to: width,
            ink: ink,
        )
    }
}
