@testable import ArgoUI
import Foundation
import Testing

/// Where a read Gantt chart is placed. The claim the whole layout exists for is the last one: the
/// axis is marked at a step whose words stand clear of each other, whatever range it covers.
@MainActor
@Suite("Mermaid gantt layout")
struct MermaidGanttLayoutTests {
    private static func chart(_ body: String) -> MermaidGantt? {
        MermaidGantt.read("gantt\ndateFormat YYYY-MM-DD\n" + body)
    }

    private static func plan(_ body: String) -> MermaidPlan {
        chart(body)?.laid ?? .empty
    }

    private static func bars(of plan: MermaidPlan) -> [CGRect] {
        plan.figures.compactMap { figure -> CGRect? in
            guard case let .shape(.rounded, rect) = figure.form else { return nil }
            return rect
        }
    }

    /// The tick words, which are every caption in the `axis` role.
    private static func tickWords(of plan: MermaidPlan) -> [MermaidCaption] {
        plan.captions.filter { $0.label.role == .axis }
    }

    private static let quarter = """
    section Reading
      The reader : 2026-01-05, 2026-02-02
      The dates  : 2026-02-02, 4w
    section Drawing
      The axis   : 2026-03-02, 2026-03-30
    """

    @Test
    func `the axis and its ticks are drawn in the shared axis role`() {
        let plan = Self.plan(Self.quarter)
        let rules = plan.figures.filter { $0.role == .axis }

        #expect(!rules.isEmpty)
        // Every line of the scale, and nothing else, is an axis: a bar is its section's own hue.
        #expect(rules.allSatisfy {
            if case .path = $0.form {
                true
            } else {
                false
            }
        })
        #expect(rules.count == Self.tickWords(of: plan).count + 1)
    }

    /// The property the tick choice exists for, asserted on the plan rather than on the chooser.
    @Test(arguments: [
        // A single day, hour by hour.
        "One day : 2026-01-05, 1d",
        // A fortnight, a quarter, a year and a decade — the ranges a fixed step falls apart across.
        "A fortnight : 2026-01-05, 2w",
        "A quarter : 2026-01-05, 2026-04-05",
        "A year : 2026-01-05, 2027-01-05",
        "A decade : 2026-01-05, 2036-01-05",
        "A century : 1926-01-05, 2026-01-05",
        "An age : 0926-01-05, 2026-01-05",
    ])
    func `no two tick labels touch, whatever the chart spans`(body: String) {
        let words = Self.tickWords(of: Self.plan(body)).map(\.rect)

        #expect(!words.isEmpty)
        for (at, word) in words.enumerated() {
            for other in words[(at + 1)...] {
                #expect(!word.intersects(other))
            }
        }
    }

    /// The ticks a chart of one day is marked at are not the ticks a chart of a decade is: the
    /// step is chosen, not fixed.
    @Test
    func `a longer chart is marked more coarsely`() {
        let day = Self.tickWords(of: Self.plan("One day : 2026-01-05, 1d"))
        let decade = Self.tickWords(of: Self.plan("A decade : 2026-01-05, 2036-01-05"))

        #expect(day.first?.label.text != decade.first?.label.text)
    }

    @Test
    func `axisFormat spells the ticks`() {
        let plain = Self.plan("A month : 2026-01-05, 2026-02-05")
        let spelled = MermaidGantt.read("""
        gantt
        dateFormat YYYY-MM-DD
        axisFormat %b %Y
        A month : 2026-01-05, 2026-02-05
        """)?.laid ?? .empty

        #expect(Self.tickWords(of: plain).first?.label.text.contains("-") == true)
        #expect(Self.tickWords(of: spelled).first?.label.text == "Jan 2026")
    }

    /// A range and the duration that comes to the same range draw the same bar.
    @Test
    func `an explicit range and its duration draw the same bar`() {
        let bars = Self.bars(of: Self.plan("""
        Ranged   : 2026-01-05, 2026-01-12
        Duration : 2026-01-05, 1w
        """))

        #expect(bars.count == 2)
        #expect(bars.first?.minX == bars.last?.minX)
        #expect(bars.first?.width == bars.last?.width)
    }

    /// A bar starting later starts further along, and a longer one runs further.
    @Test
    func `a bar is placed and sized by its own dates`() {
        let bars = Self.bars(of: Self.plan("""
        First  : 2026-01-05, 1w
        Second : 2026-02-05, 2w
        """))

        #expect(bars.count == 2)
        #expect(bars[0].minX < bars[1].minX)
        #expect(bars[0].width < bars[1].width)
    }

    @Test
    func `a section's bars take that section's own hue`() {
        let plan = Self.plan(Self.quarter)
        let hues = plan.figures.compactMap { figure -> Int? in
            guard case let .series(index) = figure.role else { return nil }
            return index
        }

        #expect(hues == [0, 0, 1])
    }

    /// The pairing `MermaidLayout` places its subviews by: one caption per label, in that order.
    @Test
    func `every label is placed, in the order the plan captions them`() {
        let chart = Self.chart(Self.quarter)

        #expect(chart?.laid.captions.map(\.label) == chart?.labels)
        #expect(chart?.labels.map(\.text).suffix(3) == ["The dates", "Drawing", "The axis"])
    }

    /// d3's pad flags are in its own format spec and get copied into real sources. `%-d` is the
    /// day WITHOUT its leading zero, so drawing it padded would spell a tick the source did not
    /// ask for.
    @Test(arguments: [
        ("%m/%d", "01/05"),
        ("%-m/%-d", "1/5"),
        ("%0m/%0d", "01/05"),
        ("%_d %b", "5 Jan"),
    ])
    func `a tick is spelled the way axisFormat padded it`(format: String, first: String) {
        let plan = MermaidGantt.read("""
        gantt
        dateFormat YYYY-MM-DD
        axisFormat \(format)
        A week : 2026-01-05, 1w
        """)?.laid ?? .empty

        #expect(Self.tickWords(of: plan).first?.label.text == first)
    }

    /// A task of no length at all is still a mark rather than nothing.
    @Test
    func `a task spanning no time still draws a bar`() {
        let bars = Self.bars(of: Self.plan("""
        A moment : 2026-01-05, 0d
        A week   : 2026-01-05, 1w
        """))

        #expect(bars.first?.width ?? 0 > 0)
    }
}
