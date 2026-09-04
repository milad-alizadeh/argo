import CoreGraphics

/// Laying one row down the shorter side of what is left, and what is left after it.
extension AtlasSquarify {
    /// The row's rectangles, and the free ground the next row is tiled into.
    ///
    /// `filling` is the last row, which takes ALL of what is left rather than the width its own
    /// weight asks for. In exact arithmetic those are the same number; in the arithmetic a computer
    /// has they differ by a fraction of a point, and that fraction is the sliver a plate would be
    /// left showing through the far edge of the last file on it.
    static func lay(
        _ weights: ArraySlice<Double>,
        at scale: Double,
        in free: CGRect,
        filling last: Bool,
    )
        -> ([CGRect], CGRect) {
        guard free.width < free.height else {
            return column(weights, at: scale, in: free, filling: last)
        }
        // A row along the top is a column down the left of the same ground turned on its diagonal,
        // so the arithmetic is written once and the wide case is spelled by turning it back.
        let (rects, rest) = column(weights, at: scale, in: free.transposed, filling: last)
        return (rects.map(\.transposed), rest.transposed)
    }

    /// The tall case: a column of the given width, its weights stacked down it.
    private static func column(
        _ weights: ArraySlice<Double>,
        at scale: Double,
        in free: CGRect,
        filling last: Bool,
    )
        -> ([CGRect], CGRect) {
        let area = weights.reduce(0, +) * scale
        let width = last ? free.width : min(CGFloat(area / Double(free.height)), free.width)
        // A row that asks for the whole of what is left leaves the next one nothing to stand on.
        // Exact arithmetic forbids it — the rows sum to the ground — but at this repository's 78x
        // spread the rounding does not, and dividing by a zero width makes every height after it
        // infinite and then NaN, which draws a plausible wrong picture rather than failing.
        guard width > 0 else {
            return (Array(repeating: .zero, count: weights.count), free)
        }
        var rects: [CGRect] = []
        var top = free.minY
        for (offset, weight) in weights.enumerated() {
            let foot = offset == weights.count - 1
                ? free.maxY
                : top + CGFloat(weight * scale / Double(width))
            rects.append(CGRect(x: free.minX, y: top, width: width, height: foot - top))
            top = foot
        }
        return (rects, CGRect(
            x: free.minX + width,
            y: free.minY,
            width: free.width - width,
            height: free.height,
        ))
    }
}

private extension CGRect {
    /// The rect with its axes swapped. Only ever applied in pairs, so nothing outside the tiler
    /// ever sees one.
    var transposed: CGRect {
        CGRect(x: minY, y: minX, width: height, height: width)
    }
}
