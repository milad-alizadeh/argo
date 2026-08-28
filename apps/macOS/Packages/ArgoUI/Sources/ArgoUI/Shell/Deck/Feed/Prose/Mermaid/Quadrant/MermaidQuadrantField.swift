import Foundation

/// The square a quadrant chart plots on, and everything placed against it.
///
/// One value rather than a rect threaded through every pass, because the field is what the title,
/// the axis words, the corners and the points are all measured from.
@MainActor
struct MermaidQuadrantField {
    let chart: MermaidQuadrant
    let rect: CGRect

    /// How tall one line of the quiet face every word around the field is set in.
    static var line: CGFloat {
        ceil(MermaidMeasure.edgeFace.lineBox)
    }

    init(_ chart: MermaidQuadrant) {
        let side = Self.side(of: chart)
        self.chart = chart
        self.rect = CGRect(
            x: Self.gutter(of: chart),
            y: Self.band(of: chart.title),
            width: side,
            height: side,
        )
    }

    /// Where a point on the 0…1 scale is drawn. Two reversals in one expression and both
    /// deliberate: y runs UP the chart and DOWN the plan, and the plotted area is held a mark's own
    /// radius inside the field so a point at 0 or at 1 is a whole dot rather than half of one lying
    /// on the border.
    func plot(_ at: CGPoint) -> CGPoint {
        let inner = rect.insetBy(dx: MermaidMeasure.pointRadius, dy: MermaidMeasure.pointRadius)
        return CGPoint(x: inner.minX + at.x * inner.width, y: inner.maxY - at.y * inner.height)
    }

    /// The border and the two rules through the centre — the axes themselves, in the one role
    /// every diagram type's axis takes.
    var figures: [MermaidFigure] {
        [
            MermaidFigure(form: .shape(.rect, rect), role: .axis),
            MermaidFigure(form: .path([
                CGPoint(x: rect.midX, y: rect.minY), CGPoint(x: rect.midX, y: rect.maxY),
            ]), role: .axis),
            MermaidFigure(form: .path([
                CGPoint(x: rect.minX, y: rect.midY), CGPoint(x: rect.maxX, y: rect.midY),
            ]), role: .axis),
        ]
    }

    /// One quarter of the field, held clear of its own border and rules.
    func quarter(_ corner: MermaidQuadrant.Corner) -> CGRect {
        CGRect(
            x: corner.isRight ? rect.midX : rect.minX,
            y: corner.isTop ? rect.minY : rect.midY,
            width: rect.width / 2,
            height: rect.height / 2,
        ).insetBy(dx: MermaidMeasure.groupInset, dy: MermaidMeasure.groupInset)
    }

    /// The room the words down the left take, which is where the field starts.
    private static func gutter(of chart: MermaidQuadrant) -> CGFloat {
        let words = width(of: [chart.yAxis.start, chart.yAxis.end])
        return words > 0 ? words + MermaidMeasure.wordGap : 0
    }

    /// The room the title takes above the field, and nothing at all where there is none.
    private static func band(of title: String) -> CGFloat {
        title.isEmpty ? 0 : ceil(ProseFace.header.lineBox) + MermaidMeasure.wordGap
    }

    /// How wide the field is drawn: its own measure, or as much again as its widest corner asks
    /// for, so four corner labels never meet in the middle.
    private static func side(of chart: MermaidQuadrant) -> CGFloat {
        let widest = width(of: chart.corners) + MermaidMeasure.groupInset * 2
        return max(MermaidMeasure.fieldSide, widest * 2)
    }

    /// How wide one of the chart's quiet words runs, and how wide the widest of several does.
    static func width(of word: String) -> CGFloat {
        ceil(ProseMetrics.width(of: word, in: MermaidMeasure.edgeFace))
    }

    private static func width(of words: [String]) -> CGFloat {
        words.map(width(of:)).max() ?? 0
    }
}
