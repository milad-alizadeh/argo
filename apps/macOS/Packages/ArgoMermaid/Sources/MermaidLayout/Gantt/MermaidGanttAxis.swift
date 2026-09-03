import Foundation

/// Where a Gantt chart's time axis is marked, and what each mark is called.
///
/// The one interesting decision in the layout. A tick every day reads a fortnight and is a smear
/// across a decade, so the step is CHOSEN: the finest of the candidates below whose words still
/// stand clear of each other at the width the chart draws itself at.
///
/// That width is the chart's own (`MermaidMeasure.axisWidth`) and never one SwiftUI handed down. A
/// diagram is as big as the thing it draws and is scrolled rather than reflowed, so there is no
/// second measure for a second answer to be given at — which is what keeps the drawn height and
/// the reported height one number (#861).
enum MermaidGanttAxis {
    struct Tick: Equatable, Sendable {
        let at: Date
        let text: String
    }

    /// The steps a scale is marked at, finest first. Each is a unit the calendar itself knows a
    /// boundary for, so a tick lands on the start of a day, a Monday or a January rather than
    /// wherever the first task happened to begin.
    private static let steps: [(unit: Calendar.Component, every: Int)] = [
        (.hour, 1), (.hour, 6), (.day, 1), (.day, 2), (.weekOfYear, 1), (.weekOfYear, 2),
        (.month, 1), (.month, 3), (.year, 1), (.year, 5), (.year, 25), (.year, 100),
    ]

    static func ticks(
        across span: ClosedRange<Date>,
        at pattern: String,
        width: CGFloat,
    )
        -> [Tick] {
        // More marks than this cannot fit however narrow their words are, so the step is given up
        // on before a single date is spelled — which is what keeps a chart of a thousand years
        // from formatting an hourly walk across it.
        let most = Int(width / MermaidMeasure.tickGap) + 2
        var coarsest: [Tick] = []
        for step in steps {
            let dates = marks(of: step, across: span, upTo: most)
            guard !dates.isEmpty else { continue }
            let ticks = dates.map {
                Tick(at: $0, text: MermaidGanttClock.words(of: $0, at: pattern))
            }
            if fits(ticks, across: span, width: width) {
                return ticks
            }
            coarsest = ticks
        }
        // Even a mark a century overflowed, which takes a span of thousands of years. One mark, on
        // the date the tasks start: true, and unable to collide with anything.
        guard !coarsest.isEmpty else {
            let start = span.lowerBound
            return [Tick(at: start, text: MermaidGanttClock.words(of: start, at: pattern))]
        }
        return thinned(coarsest, across: span, width: width)
    }

    /// Where a date falls along the axis.
    static func x(of date: Date, across span: ClosedRange<Date>, width: CGFloat) -> CGFloat {
        let whole = span.upperBound.timeIntervalSince(span.lowerBound)
        guard whole > 0 else { return 0 }
        return width * date.timeIntervalSince(span.lowerBound) / whole
    }

    /// Whether no two of these words touch. The property the whole choice exists for, and it is
    /// checked on the NARROWEST gap rather than on an average: ticks a calendar sets are not
    /// evenly spaced, and February is where a run of months first collides.
    private static func fits(_ ticks: [Tick], across span: ClosedRange<Date>, width: CGFloat)
        -> Bool {
        let slot = (ticks.map { MermaidGanttWords.width(of: $0.text) }.max() ?? 0)
            + MermaidMeasure.tickGap
        let places = ticks.map { x(of: $0.at, across: span, width: width) }
        return zip(places, places.dropFirst()).allSatisfy { $1 - $0 >= slot }
    }

    /// The coarsest step, marked every nth instead of every one — the last resort when even a
    /// century of them will not fit. The caller has already ruled out an empty run; the `max` is
    /// what keeps the range total rather than a trap. It ends: at `count` the run is a single mark,
    /// and one mark cannot collide with anything.
    private static func thinned(_ ticks: [Tick], across span: ClosedRange<Date>, width: CGFloat)
        -> [Tick] {
        for every in 1 ... max(ticks.count, 1) {
            let kept = ticks.enumerated().filter { $0.offset.isMultiple(of: every) }.map(\.element)
            if fits(kept, across: span, width: width) {
                return kept
            }
        }
        return Array(ticks.prefix(1))
    }

    /// Every mark of one step inside the span, snapped to the unit's own boundary. A boundary
    /// BEFORE the span is stepped past rather than drawn, so the axis starts where the tasks do.
    ///
    /// Empty where there are more than `limit` of them, which reads as "this step does not fit"
    /// and sends the choice on to the next one.
    private static func marks(
        of step: (unit: Calendar.Component, every: Int),
        across span: ClosedRange<Date>,
        upTo limit: Int,
    )
        -> [Date] {
        guard var at = MermaidGanttClock.start(of: step.unit, at: span.lowerBound)
        else { return [] }
        var marks: [Date] = []
        while at <= span.upperBound {
            if at >= span.lowerBound {
                guard marks.count < limit else { return [] }
                marks.append(at)
            }
            guard let next = MermaidGanttClock.calendar
                .date(byAdding: step.unit, value: step.every, to: at), next > at
            else { break }
            at = next
        }
        return marks
    }
}

extension MermaidGantt {
    /// The marks on this chart's axis, at the width the chart draws itself at. Read by `labels`
    /// and by the layout, so the words the view builds and the places the plan sets them are one
    /// answer rather than two that have to agree.
    var ticks: [MermaidGanttAxis.Tick] {
        guard let span else { return [] }
        return MermaidGanttAxis.ticks(
            across: span,
            at: axisPattern,
            width: MermaidMeasure.axisWidth,
        )
    }
}
