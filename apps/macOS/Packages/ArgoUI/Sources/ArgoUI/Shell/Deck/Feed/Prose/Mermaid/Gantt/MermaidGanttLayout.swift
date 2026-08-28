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

    /// A task's bar on its own line of the gutter, in its section's hue — and BROKEN around every
    /// day the chart excludes, which is why a task can draw more than one figure (#904). A solid
    /// bar across an excluded weekend would say work happens on a day the chart says it cannot.
    var bars: [MermaidFigure] {
        gantt.rows.enumerated().flatMap { at, row -> [MermaidFigure] in
            guard case let .task(task, series) = row else { return [] }
            let line = rowRect(at)
            return gantt.excludes.runs(from: task.start, to: task.end).map { run in
                MermaidFigure(form: .shape(.rounded, bar(run, on: line)), role: .series(series))
            }
        }
    }

    /// One stretch of a task, on its row. A stretch of no length is still a mark: a bar of nothing
    /// at all would say the source wrote no task there.
    private func bar(_ run: ClosedRange<Date>, on line: CGRect) -> CGRect {
        let from = x(of: run.lowerBound)
        return CGRect(
            x: from,
            y: line.midY - Self.barHeight / 2,
            width: max(MermaidMeasure.barMinWidth, x(of: run.upperBound) - from),
            height: Self.barHeight,
        )
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
