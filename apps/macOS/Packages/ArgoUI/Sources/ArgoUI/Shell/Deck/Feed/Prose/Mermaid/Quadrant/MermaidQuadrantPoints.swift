import Foundation

/// A quadrant chart's points, drawn: a mark where each plots, and its name beside it.
///
/// The names are the whole of this file. Points cluster — telling a cluster from a spread is what a
/// quadrant chart is FOR — and a name drawn at a fixed offset from its own mark is a name drawn
/// over its neighbour's. Each takes the first place clear of every mark and every word already
/// settled, the field's own title, axis ends and corners INCLUDED. That is an order rather than a
/// search: the same chart places the same names the same way every time.
@MainActor
enum MermaidQuadrantPoints {
    static func dots(of field: MermaidQuadrantField) -> [CGRect] {
        field.chart.points.map { point in
            let centre = field.plot(point.at)
            let radius = MermaidMeasure.pointRadius
            return CGRect(
                x: centre.x - radius,
                y: centre.y - radius,
                width: radius * 2,
                height: radius * 2,
            )
        }
    }

    /// One caption per point, in the order the source plotted them.
    static func names(
        of points: [MermaidQuadrant.Point],
        on dots: [CGRect],
        clear settled: [CGRect],
    )
        -> [MermaidCaption] {
        var settled = settled
        var names: [MermaidCaption] = []
        for (point, dot) in zip(points, dots) {
            let rect = place(point.name, by: dot, clear: settled)
            settled.append(rect)
            names.append(MermaidCaption(
                label: MermaidLabel(text: point.name, face: MermaidMeasure.edgeFace),
                rect: rect,
            ))
        }
        return names
    }

    /// The nearest standing place clear of everything settled so far, or its own mark where a
    /// cluster leaves nothing free at all.
    private static func place(_ name: String, by dot: CGRect, clear: [CGRect]) -> CGRect {
        let size = CGSize(
            width: MermaidQuadrantField.width(of: name),
            height: MermaidQuadrantField.line,
        )
        let tries = candidates(size, by: dot)
        return tries.first { rect in !clear.contains { $0.intersects(rect) } } ?? dot
    }

    /// Where a name may stand, nearest first: under its mark, over it, then to each side, then a
    /// line further out again.
    private static func candidates(_ size: CGSize, by dot: CGRect) -> [CGRect] {
        let middle = dot.midX - size.width / 2
        let level = dot.midY - size.height / 2
        return (0 ..< 3).flatMap { step -> [CGRect] in
            let out = MermaidMeasure.wordGap + size.height * CGFloat(step)
            return [
                CGRect(origin: CGPoint(x: middle, y: dot.maxY + out), size: size),
                CGRect(origin: CGPoint(x: middle, y: dot.minY - out - size.height), size: size),
                CGRect(origin: CGPoint(x: dot.maxX + out, y: level), size: size),
                CGRect(origin: CGPoint(x: dot.minX - out - size.width, y: level), size: size),
            ]
        }
    }
}
