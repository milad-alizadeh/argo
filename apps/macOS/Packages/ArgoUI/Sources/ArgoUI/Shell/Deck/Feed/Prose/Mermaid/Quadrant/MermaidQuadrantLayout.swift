import Foundation

// A quadrant chart placed. The simplest layout of the three so far and deliberately so: there is
// nothing to rank and nothing to route, because the source states coordinates. A square field, a
// cross through it, and every mark placed against those.
//
// The order below is the one thing that matters: the marks are plotted from the data, the chart's
// own words are placed clear of them, and the points' names are placed clear of both. A point
// cannot give way, because it IS the data.

@MainActor
extension MermaidQuadrant {
    var laid: MermaidPlan {
        let field = MermaidQuadrantField(self)
        let dots = MermaidQuadrantPoints.dots(of: field)
        let words = field.captions(clear: dots)
        return MermaidPlan(
            // The field first, so the points are read on it rather than through it.
            figures: field.figures + dots.map {
                MermaidFigure(form: .shape(.ellipse, $0), role: .emphasis)
            },
            captions: words + MermaidQuadrantPoints.names(
                of: points,
                on: dots,
                clear: words.map(\.rect) + dots,
            ),
            size: CGSize(width: field.rect.maxX, height: field.rect.maxY),
        ).normalised
    }
}
