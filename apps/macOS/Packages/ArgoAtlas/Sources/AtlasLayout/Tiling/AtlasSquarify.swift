import CoreGraphics

/// Squarified treemap tiling: Bruls, Huizing and van Wijk's rule of filling the shorter side with
/// the row that keeps the worst aspect ratio in it lowest, then tiling what is left over again.
///
/// A slice-and-dice tiler is one line shorter and draws threads: the fixture's largest file is 78×
/// the median, and at that spread every other file becomes a hairline nobody can point at.
enum AtlasSquarify {
    /// One rectangle per weight, in the order given, together covering `rect` exactly.
    ///
    /// Weights must be positive and DESCENDING. Descending is what makes the row test below O(1) —
    /// the largest in a row is the one it opened with and the smallest is the one just offered —
    /// and it is the order the technique is defined in.
    static func rects(of weights: [Double], in rect: CGRect) -> [CGRect] {
        let total = weights.reduce(0, +)
        guard total > 0, rect.width > 0, rect.height > 0 else {
            return Array(repeating: .zero, count: weights.count)
        }
        // Area per unit of weight, taken ONCE off the whole rect. Recomputing it per row against
        // what is left would compound each row's rounding into the next.
        let scale = Double(rect.width) * Double(rect.height) / total
        var placed: [CGRect] = []
        var free = rect
        var index = 0
        while index < weights.count {
            let row = weights[index ..< index + length(of: weights[index...], in: free, at: scale)]
            let (rects, rest) = lay(
                row,
                at: scale,
                in: free,
                filling: row.endIndex == weights.count,
            )
            placed += rects
            free = rest
            index = row.endIndex
        }
        return placed
    }

    /// How many of the remaining weights belong in the next row: one more for as long as adding it
    /// makes the row's worst rectangle squarer, and never fewer than one.
    private static func length(
        of weights: ArraySlice<Double>,
        in free: CGRect,
        at scale: Double,
    )
        -> Int {
        let side = Double(min(free.width, free.height))
        guard var row = weights.first.map({ Row(largest: $0) }) else { return 0 }
        var length = 0
        var best = Double.infinity
        for weight in weights {
            let candidate = row.offered(weight)
            let ratio = candidate.worst(over: side, at: scale)
            if length > 0, ratio > best {
                break
            }
            row = candidate
            best = ratio
            length += 1
        }
        return max(length, 1)
    }

    /// A row being built: what it weighs, and the two files that decide how square it can be. The
    /// weights arrive descending, so the largest is the one the row opened with and the smallest is
    /// whichever was offered last.
    private struct Row {
        let largest: Double
        var sum = 0.0
        var smallest = 0.0

        func offered(_ weight: Double) -> Row {
            Row(largest: largest, sum: sum + weight, smallest: weight)
        }

        /// The least square rectangle the row would hold, as its long side over its short one.
        func worst(over side: Double, at scale: Double) -> Double {
            let area = sum * scale
            guard area > 0, side > 0, smallest > 0 else { return .infinity }
            let square = side * side
            return max(
                square * largest * scale / (area * area),
                area * area / (square * smallest * scale),
            )
        }
    }
}
