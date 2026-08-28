import Foundation

// The words a quadrant chart sets around and inside its field: the title over it, both ends of
// each axis outside it, and the four corners in it.
//
// They are placed by ZIPPING `MermaidQuadrant.labels` with the places below, so the pairing the
// view rests on — one `Text` per label, on the caption at the same index — is made by construction
// rather than by two lists happening to agree.

@MainActor
extension MermaidQuadrantField {
    /// One caption per fixed label, in `MermaidQuadrant.labels`' own order, held clear of the marks
    /// already plotted. The points' own names follow, from `MermaidQuadrantPoints`.
    func captions(clear dots: [CGRect]) -> [MermaidCaption] {
        zip(chart.labels, places(clear: dots)).map { label, place in
            MermaidCaption(
                // A label saying nothing takes no room: a plan is as big as its marks, and an
                // empty caption given a line's height would leave a band of nothing under the
                // field.
                label: label,
                rect: label.text.isEmpty ? CGRect(origin: place.rect.origin, size: .zero)
                    : place.rect,
                alignment: place.alignment,
            )
        }
    }

    private typealias Place = (rect: CGRect, alignment: MermaidCaption.Alignment)

    private func places(clear dots: [CGRect]) -> [Place] {
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
        ] + MermaidQuadrant.Corner.allCases.map { place(of: $0, clear: dots) }
    }

    /// A corner's words, standing in the corner of its own quarter rather than in the middle of it,
    /// where the points are — and a line further in again for every mark plotted under them. The
    /// point cannot move, because it is the data.
    private func place(of corner: MermaidQuadrant.Corner, clear dots: [CGRect]) -> Place {
        let box = quarter(corner)
        let width = min(box.width, Self.width(of: chart.corners[corner.rawValue - 1]))
        let steps = (0 ..< 3).map { step -> CGRect in
            let inward = Self.line * CGFloat(corner.isTop ? step : -step)
            return CGRect(
                x: corner.isRight ? box.maxX - width : box.minX,
                y: (corner.isTop ? box.minY : box.maxY - Self.line) + inward,
                width: width,
                height: Self.line,
            )
        }
        let clear = steps.first { rect in !dots.contains { $0.intersects(rect) } }
        return (clear ?? steps[0], corner.isRight ? .trailing : .leading)
    }
}
