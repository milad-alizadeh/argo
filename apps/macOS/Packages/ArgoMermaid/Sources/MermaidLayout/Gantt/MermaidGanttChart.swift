import ArgoDesign
import Foundation

/// A Gantt chart's geometry: the gutter its names stand in, the band its bars are drawn across,
/// and where a date falls along it.
///
/// One value rather than a handful of measurements threaded through the layout — the axis, its
/// ticks and every bar are placed against ONE arithmetic instead of three that have to agree.
struct MermaidGanttChart {
    let gantt: MermaidGantt
    let span: ClosedRange<Date>
    let ticks: [MermaidGanttAxis.Tick]
    /// The band the bars are drawn in: the axis's own width, from the rule down past the last row.
    let plot: CGRect
    /// How wide the names down the left run.
    let gutter: CGFloat

    /// `nil` for a chart with no task in it, which is a chart the reader never returns.
    init?(_ gantt: MermaidGantt) {
        guard let span = gantt.span else { return nil }
        let ticks = gantt.ticks
        let gutter = Self.gutter(of: gantt)
        // Half the widest date, kept either side: a tick's words are centred ON the mark, so the
        // first would otherwise be written over the names and the last off the block.
        let margin = (ticks.map { MermaidGanttWords.width(of: $0.text) }.max() ?? 0) / 2
        self.gantt = gantt
        self.span = span
        self.ticks = ticks
        self.gutter = gutter
        self.plot = CGRect(
            x: gutter + MermaidMeasure.wordGap + margin,
            y: Self.titleHeight(of: gantt) + MermaidGanttWords.line + MermaidMeasure.wordGap,
            width: MermaidMeasure.axisWidth,
            height: Self.rowHeight * CGFloat(gantt.rows.count),
        )
    }

    /// How tall one line of the gutter stands, and how deep a bar is drawn inside it.
    static var rowHeight: CGFloat {
        MermaidGanttWords.line + ArgoSpacing.snug
    }

    static var barHeight: CGFloat {
        rowHeight - ArgoSpacing.snug
    }

    /// What the title takes off the top, its own gap included — nothing at all where there is
    /// none, so an untitled chart starts at its own axis.
    static func titleHeight(of gantt: MermaidGantt) -> CGFloat {
        gantt.title.isEmpty ? 0 : ceil(MermaidMeasure.titleFace.lineBox) + MermaidMeasure.messageGap
    }

    /// Where a date is drawn. Clamped to the plot, because the axis spans exactly the range the
    /// tasks cover and nothing is placed outside it.
    func x(of date: Date) -> CGFloat {
        plot.minX + MermaidGanttAxis.x(of: date, across: span, width: plot.width)
    }

    /// Half the widest date, which is the room kept either side of the axis for the first and the
    /// last of them.
    var margin: CGFloat {
        plot.minX - gutter - MermaidMeasure.wordGap
    }

    /// The room a tick's own words are given, centred on its mark.
    func tickRect(of tick: MermaidGanttAxis.Tick) -> CGRect {
        CGRect(
            x: x(of: tick.at) - margin,
            y: Self.titleHeight(of: gantt),
            width: margin * 2,
            height: MermaidGanttWords.line,
        )
    }

    /// The nth line of the gutter, across the whole block.
    func rowRect(_ at: Int) -> CGRect {
        CGRect(
            x: 0,
            y: plot.minY + Self.rowHeight * CGFloat(at),
            width: size.width,
            height: Self.rowHeight,
        )
    }

    var size: CGSize {
        CGSize(width: plot.maxX + margin, height: plot.maxY)
    }

    /// How wide the names run: every heading and every task measured at its own face, because a
    /// column sized to the quiet one clips the bold headings standing in it.
    private static func gutter(of gantt: MermaidGantt) -> CGFloat {
        gantt.rows.map { row in
            switch row {
            case let .heading(name): MermaidGanttWords.width(of: name, in: MermaidMeasure.groupFace)
            case let .task(task, _): MermaidGanttWords.width(of: task.name)
            }
        }.max() ?? 0
    }
}
