@testable import ArgoUI
import Foundation
import Testing

/// What an exclusion does to the ink, which is the half of it a reading test cannot see.
@MainActor
@Suite("Mermaid gantt excluded bars")
struct MermaidGanttExcludedBarTests {
    private static func bars(_ body: String) -> [CGRect] {
        let plan = MermaidGantt.read("gantt\ndateFormat YYYY-MM-DD\n" + body)?.laid ?? .empty
        return plan.figures.compactMap { figure -> CGRect? in
            guard case let .shape(.rounded, rect) = figure.form else { return nil }
            return rect
        }
    }

    /// The claim `excludes` exists for. A bar drawn solid from Thursday to the Thursday after
    /// would say work happened over the weekend the chart just said it does not.
    @Test
    func `a bar is broken around the days it says no work happens on`() {
        let drawn = Self.bars("excludes weekends\nAcross a weekend : 2026-01-01, 5d")

        #expect(drawn.count == 2)
        #expect(drawn.first?.maxX ?? 0 < drawn.last?.minX ?? 0)
        #expect(drawn.first?.minY == drawn.last?.minY)
    }

    /// And the chart that excludes nothing draws exactly what #903 drew: one bar, unbroken.
    @Test
    func `a chart with no day off draws one bar per task`() {
        let drawn = Self.bars("Across a weekend : 2026-01-01, 5d")

        #expect(drawn.count == 1)
    }

    /// The written start stayed on the Saturday; the INK is what moves. So the bar opens at the
    /// Monday and not at the date on the row, which is the whole of why the reader need not move
    /// a date the source wrote.
    @Test
    func `a bar dated from a day off opens where work can`() {
        // Both rows on ONE chart, so the two bars are placed against the same axis and their
        // left edges are comparable at all.
        let drawn = Self.bars("""
        excludes weekends
        Sat to Wed : 2026-01-03, 2026-01-07
        Mon to Wed : 2026-01-05, 2026-01-07
        """)

        #expect(drawn.count == 2)
        #expect(drawn.first?.minX == drawn.last?.minX)
        #expect(drawn.first?.width == drawn.last?.width)
    }

    /// And a task dated entirely inside its days off keeps the mark a zero-length one gets rather
    /// than vanishing off its own row — the source wrote a task there.
    @Test
    func `a task with no working day in it still leaves a mark`() {
        let drawn = Self.bars("""
        excludes weekends
        Weekend work : 2026-01-03, 2026-01-04
        Normal work  : 2026-01-05, 1d
        """)

        #expect(drawn.count == 2)
        #expect(drawn.first?.width ?? 0 > 0)
    }
}
