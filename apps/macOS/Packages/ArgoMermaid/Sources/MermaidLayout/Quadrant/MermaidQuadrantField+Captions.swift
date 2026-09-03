import Foundation

// The words a quadrant chart sets around and inside its field: the title over it, both ends of
// each axis outside it, and the four corners in it.
//
// They are placed by ZIPPING `MermaidQuadrant.labels` with the places below, so the pairing the
// view rests on — one `Text` per label, on the caption at the same index — holds by construction.

extension MermaidQuadrantField {
    /// One caption per fixed label, in `MermaidQuadrant.labels`' own order, held clear of the marks
    /// already plotted. The points' own names follow, from `MermaidQuadrantPoints`.
    func captions(clear dots: [CGRect]) -> [MermaidCaption] {
        zip(chart.labels, places(clear: dots)).map { label, place in
            MermaidCaption(
                label: label,
                // A label saying nothing takes no room, so an empty one leaves no band of nothing.
                rect: label.text.isEmpty ? CGRect(origin: place.rect.origin, size: .zero)
                    : place.rect,
                alignment: place.alignment,
            )
        }
    }

    private typealias Place = (rect: CGRect, alignment: MermaidCaption.Alignment)

    private func places(clear dots: [CGRect]) -> [Place] {
        let outside = around()
        return outside + MermaidQuadrant.Corner.allCases.map {
            place(of: $0, clear: dots + outside.map(\.rect))
        }
    }

    /// The title over the field and both ends of each axis outside it, in `labels`' own order.
    private func around() -> [Place] {
        let line = Self.line
        let below = rect.maxY + MermaidMeasure.wordGap
        let gutter = max(0, rect.minX - MermaidMeasure.wordGap)
        return [
            // The title's own line box and not the quiet face's: it is set bigger than everything
            // else on the chart, and a rect measured at the smaller face clips its ascenders.
            (
                CGRect(
                    x: rect.minX,
                    y: 0,
                    width: rect.width,
                    height: max(0, rect.minY - MermaidMeasure.wordGap),
                ),
                .middle,
            ),
            (CGRect(x: rect.minX, y: below, width: rect.width / 2, height: line), .leading),
            (CGRect(x: rect.midX, y: below, width: rect.width / 2, height: line), .trailing),
            // The low end of the y axis stands at the FOOT of the field and the high end at its
            // head, which is the same flip the points are plotted through.
            (CGRect(x: 0, y: rect.maxY - line, width: gutter, height: line), .trailing),
            (CGRect(x: 0, y: rect.minY, width: gutter, height: line), .trailing),
        ]
    }

    /// A corner's words, in the corner of its own quarter — and stepping OUT of the field, a line
    /// at a time, for anything already standing there. Out and never in: a corner label walking
    /// toward the centre walks into the cluster its own quadrant is about, and then reads as a
    /// second name on whichever mark it lands beside.
    ///
    /// The walk ends because `taken` is finite and each step stands further out than the last.
    private func place(of corner: MermaidQuadrant.Corner, clear taken: [CGRect]) -> Place {
        let box = quarter(corner)
        let width = min(box.width, Self.width(of: chart[corner]))
        let x = corner.isRight ? box.maxX - width : box.minX
        var y = corner.isTop ? box.minY : box.maxY - Self.line
        var rect = CGRect(x: x, y: y, width: width, height: Self.line)
        while taken.contains(where: { $0.intersects(rect) }) {
            y += corner.isTop ? -Self.line : Self.line
            rect = CGRect(x: x, y: y, width: width, height: Self.line)
        }
        return (rect, corner.isRight ? .trailing : .leading)
    }
}
