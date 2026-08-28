import Foundation

/// A quadrant chart's points, drawn: a mark where each plots, and its name beside it.
///
/// The names are the whole of this file: points cluster, and a name drawn at a fixed offset from
/// its own mark is a name drawn over its neighbour's. Each takes the first place clear of every
/// mark and every word already settled, the field's own title, axis ends and corners INCLUDED.
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

    /// The nearest place clear of everything settled so far. A cluster can take every place at one
    /// distance, so the search steps further OUT rather than giving up — a name that gave up on its
    /// own mark would be squeezed to the width of a dot and drawn over it.
    ///
    /// The walk ends because `clear` is finite and each step stands further out than the last.
    private static func place(_ name: String, by dot: CGRect, clear: [CGRect]) -> CGRect {
        let size = CGSize(
            width: MermaidQuadrantField.width(of: name),
            height: MermaidQuadrantField.line,
        )
        var step = 0
        while true {
            let tries = candidates(size, by: dot, at: step)
            if let free = tries.first(where: { rect in !clear.contains { $0.intersects(rect) } }) {
                return free
            }
            step += 1
        }
    }

    /// The four places a name may stand `step` lines out from its own mark: under it, over it, and
    /// to each side.
    private static func candidates(_ size: CGSize, by dot: CGRect, at step: Int) -> [CGRect] {
        let out = MermaidMeasure.wordGap + size.height * CGFloat(step)
        let middle = dot.midX - size.width / 2
        let level = dot.midY - size.height / 2
        return [
            CGRect(origin: CGPoint(x: middle, y: dot.maxY + out), size: size),
            CGRect(origin: CGPoint(x: middle, y: dot.minY - out - size.height), size: size),
            CGRect(origin: CGPoint(x: dot.maxX + out, y: level), size: size),
            CGRect(origin: CGPoint(x: dot.minX - out - size.width, y: level), size: size),
        ]
    }
}
