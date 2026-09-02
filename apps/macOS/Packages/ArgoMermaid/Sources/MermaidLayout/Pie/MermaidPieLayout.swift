import Foundation

// A pie chart placed: a circle of wedges, and a legend beside it naming each one. A third shape of
// layout again, and deliberately so — there is no ranking, no ordering and no routing, because a
// share is the only geometry a pie has.
//
// It produces the very same `MermaidPlan`, drawn by the very same view and mapped by the very same
// lane, on one figure the spine did not have before (#859).

@MainActor
extension MermaidPie {
    var laid: MermaidPlan {
        guard !slices.isEmpty else { return .empty }
        let legend = MermaidPieLegend(self)
        let top = titleHeight
        let band = max(MermaidMeasure.chartDiameter, legend.height)
        let circle = CGRect(
            x: 0,
            y: top + (band - MermaidMeasure.chartDiameter) / 2,
            width: MermaidMeasure.chartDiameter,
            height: MermaidMeasure.chartDiameter,
        )
        let origin = CGPoint(
            x: circle.maxX + MermaidMeasure.nodeGap,
            y: top + (band - legend.height) / 2,
        )
        return MermaidPlan(
            figures: wedges(in: circle) + legend.swatches(from: origin),
            // In `labels`' own order — the title, then the names, then the readings — which is the
            // pairing `MermaidLayout` places its subviews by.
            captions: titleCaption(across: origin.x + legend.width)
                + legend.nameCaptions(from: origin) + legend.readingCaptions(from: origin),
            size: CGSize(width: origin.x + legend.width, height: top + band),
        ).normalised
    }

    /// One wedge per slice, in written order and starting at twelve o'clock.
    ///
    /// A slice worth nothing draws nothing — which is also what a chart of nothing but zeroes
    /// comes to, and is why there is no division to guard here.
    private func wedges(in circle: CGRect) -> [MermaidFigure] {
        var turn: Double = 0
        return shares.enumerated().compactMap { at, share in
            defer { turn += share }
            guard share > 0 else { return nil }
            return MermaidFigure(
                form: .arc(MermaidArc(start: turn, end: turn + share), circle),
                role: .series(at),
            )
        }
    }

    /// The chart's own name, over the whole figure — or nothing, where the source named it
    /// nothing. `labels` skips it on the same condition, and the two have to agree.
    private func titleCaption(across width: CGFloat) -> [MermaidCaption] {
        guard let titleLabel else { return [] }
        return [MermaidCaption(
            label: titleLabel,
            rect: CGRect(x: 0, y: 0, width: width, height: ceil(MermaidMeasure.titleFace.lineBox)),
        )]
    }

    /// What the title takes off the top, its own gap included. Zero where there is no title, so an
    /// untitled chart starts at the circle rather than under a blank line.
    private var titleHeight: CGFloat {
        title.isEmpty ? 0 : ceil(MermaidMeasure.titleFace.lineBox) + MermaidMeasure.messageGap
    }
}
