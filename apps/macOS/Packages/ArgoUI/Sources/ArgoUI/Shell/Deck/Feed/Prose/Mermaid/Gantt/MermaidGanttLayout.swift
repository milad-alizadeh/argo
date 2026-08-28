import Foundation

// A Gantt chart placed: a dated axis across the top, a rule dropped from every tick, and a bar per
// task under it in its section's own hue.
//
// The captions go down in `MermaidGantt.labels`' own order — the title, then the ticks, then every
// line of the gutter — which is the pairing `MermaidLayout` places its subviews by.

@MainActor
extension MermaidGantt {
    var laid: MermaidPlan {
        guard let chart = MermaidGanttChart(self) else { return .empty }
        return MermaidPlan(
            // The scale first, so the bars are read on it rather than through it.
            figures: chart.scale + chart.bars,
            captions: chart.titleCaption + chart.tickCaptions + chart.rowCaptions,
            size: chart.size,
        ).normalised
    }
}

@MainActor
extension MermaidGanttChart {
    /// The axis and the rules dropped from its ticks, all in the shared `axis` role — the scale
    /// the chart is measured against rather than a thing it is about.
    var scale: [MermaidFigure] {
        let rule = MermaidFigure(form: .path([
            CGPoint(x: plot.minX, y: plot.minY), CGPoint(x: plot.maxX, y: plot.minY),
        ]), role: .axis)
        return [rule] + ticks.map { tick in
            MermaidFigure(form: .path([
                CGPoint(x: x(of: tick.at), y: plot.minY),
                CGPoint(x: x(of: tick.at), y: plot.maxY),
            ]), role: .axis)
        }
    }

    /// One bar per task, on its own line of the gutter and in its section's hue.
    var bars: [MermaidFigure] {
        gantt.rows.enumerated().compactMap { at, row in
            guard case let .task(task, series) = row else { return nil }
            let row = rowRect(at)
            let start = x(of: task.start)
            return MermaidFigure(
                form: .shape(.rounded, CGRect(
                    x: start,
                    y: row.midY - Self.barHeight / 2,
                    // A task of no length is still a mark: a bar of nothing at all would say the
                    // source wrote no task there.
                    width: max(MermaidMeasure.barMinWidth, x(of: task.end) - start),
                    height: Self.barHeight,
                )),
                role: .series(series),
            )
        }
    }

    /// The chart's own name, over the whole figure — or nothing, where the source named it
    /// nothing. `MermaidGantt.labels` skips it on the same condition, and the two have to agree.
    var titleCaption: [MermaidCaption] {
        guard let label = gantt.titleLabel else { return [] }
        return [MermaidCaption(
            label: label,
            rect: CGRect(
                x: 0,
                y: 0,
                width: size.width,
                height: ceil(MermaidMeasure.titleFace.lineBox),
            ),
        )]
    }

    var tickCaptions: [MermaidCaption] {
        ticks.map { tick in
            MermaidCaption(
                label: MermaidLabel(
                    text: tick.text,
                    face: MermaidMeasure.edgeFace,
                    role: .axis,
                ),
                rect: tickRect(of: tick),
            )
        }
    }

    /// Every heading and every name down the gutter, on the line the bars were placed against.
    var rowCaptions: [MermaidCaption] {
        zip(gantt.labels.suffix(gantt.rows.count), gantt.rows.indices).map { label, at in
            MermaidCaption(
                label: label,
                rect: CGRect(
                    x: 0,
                    y: rowRect(at).minY,
                    width: gutter,
                    height: Self.rowHeight,
                ),
                alignment: .leading,
            )
        }
    }
}
