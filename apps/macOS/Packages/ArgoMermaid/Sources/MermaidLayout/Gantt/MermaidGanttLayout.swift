import Foundation

// A Gantt chart placed: a dated axis across the top, a rule dropped from every tick, and a bar per
// task under it in its section's own hue.
//
// The captions go down in `MermaidGantt.labels`' own order — the title, then the ticks, then every
// line of the gutter — which is the pairing `MermaidLayout` places its subviews by.

extension MermaidGantt {
    var laid: MermaidPlan {
        guard let chart = MermaidGanttChart(self) else { return .empty }
        return MermaidPlan(
            // The scale first, so the bars are read on it rather than through it.
            figures: chart.scale + chart.marks,
            captions: chart.titleCaption + chart.tickCaptions + chart.rowCaptions,
            size: chart.size,
        ).normalised
    }
}

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

    /// One mark per stretch of a task, on its own line of the gutter and in its section's hue:
    /// laid down at the weight its progress asks for, and RINGED where the source called it
    /// critical.
    ///
    /// A task draws more than one figure when the chart excludes a day inside it (#904) — a solid
    /// bar across an excluded weekend would say work happens on a day the chart says it cannot.
    /// Every stretch takes the SAME weight and the same ring: a `done` task broken around a
    /// weekend that drew its first run spent and the rest ordinary would say the work restarted.
    ///
    /// The ring is `emphasis` — the diagram's own call-out role — and DELIBERATELY not one of the
    /// four operational state hues. #864 holds every series hue clear of those four precisely so a
    /// chart mark is never read as a Session's state, and a critical bar rimmed in
    /// `state.attention` inches from an amber Permission chip in the same feed would say exactly
    /// that. The same contract holds every series hue 0.25 off `interaction.accent`
    /// (`SeriesPaletteTests`), so the ring cannot resolve near the bar it rings whatever hue the
    /// section drew.
    ///
    /// `crit` is also not a rung of the weight ramp: the source writes `crit, active`, and a rung
    /// holds one value.
    var marks: [MermaidFigure] {
        gantt.rows.enumerated().flatMap { at, row -> [MermaidFigure] in
            guard case let .task(task, series) = row else { return [] }
            let (outline, boxes) = boxes(of: task, on: rowRect(at))
            return boxes.flatMap { drawn(outline, $0, as: (task, series)) }
        }
    }

    /// One box drawn: the fill, and the ring round it where the task is critical.
    private func drawn(
        _ outline: MermaidOutline,
        _ box: CGRect,
        as task: (task: MermaidGantt.Task, series: Int),
    )
        -> [MermaidFigure] {
        guard task.task.isCritical else {
            return [MermaidFigure(
                form: .shape(outline, box),
                role: .series(task.series),
                weight: task.task.weight,
            )]
        }
        let ringed = Self.ringed(box)
        return [
            MermaidFigure(
                form: .shape(outline, ringed.fill),
                role: .series(task.series),
                weight: task.task.weight,
            ),
            // After the fill, so the ring is round the mark rather than under it.
            MermaidFigure(form: .shape(outline, ringed.ring), role: .emphasis, line: .thick),
        ]
    }

    /// Where the ring goes, and where the fill goes under it.
    ///
    /// The ring stands OUTSIDE the fill rather than on its edge. On the deck the accent is 5.7:1
    /// against every section hue; drawn ON one it is as little as 1.04:1, so a ring over the fill
    /// would be carried by hue alone on the olive and the mauve. Insetting the fill rather than
    /// growing the ring also keeps the whole mark exactly a bar deep, so a ringed row does not
    /// stand proud of the rhythm the rows around it keep.
    private static func ringed(_ box: CGRect) -> (fill: CGRect, ring: CGRect) {
        let room = min(MermaidMeasure.thickStroke, box.width / 4, box.height / 4)
        return (box.insetBy(dx: room, dy: room), box.insetBy(dx: room / 2, dy: room / 2))
    }

    /// Every box a task's mark stands in: one per stretch of working days its bar is broken into,
    /// or — where the source called it a milestone — the single square its diamond fills.
    ///
    /// The diamond takes the ROW's height and not the bar's: it covers half the box it is drawn
    /// in, so at a bar's own depth it reads as half a mark rather than as the landmark it is.
    private func boxes(of task: MermaidGantt.Task, on line: CGRect) -> (MermaidOutline, [CGRect]) {
        guard !task.isMilestone else {
            let at = x(of: task.start)
            return (.diamond, [CGRect(
                x: at - line.height / 2,
                y: line.midY - line.height / 2,
                width: line.height,
                height: line.height,
            )])
        }
        let runs = gantt.excludes.runs(from: task.start, to: task.end)
        return (.rounded, runs.map { bar($0, on: line) })
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
