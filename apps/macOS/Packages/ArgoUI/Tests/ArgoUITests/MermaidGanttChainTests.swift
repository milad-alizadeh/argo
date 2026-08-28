@testable import ArgoUI
import Foundation
import Testing

/// The two ways a bar's real span stops being what the source literally says (#904): a start
/// named after another task, and days the chart is told no work happens on.
@Suite("Mermaid gantt chains")
struct MermaidGanttChainTests {
    private static func date(_ text: String) -> Date? {
        MermaidGanttClock.date(text, at: "yyyy-MM-dd")
    }

    private static func read(_ body: String) -> MermaidGantt? {
        MermaidGantt.read("gantt\ndateFormat YYYY-MM-DD\n" + body)
    }

    private static func tasks(_ body: String) -> [MermaidGantt.Task] {
        read(body)?.sections.flatMap(\.tasks) ?? []
    }

    @Test
    func `a task written after another begins where that one ends`() {
        let read = Self.tasks("""
        First  :a1, 2026-01-05, 4d
        Second :a2, after a1, 2d
        """)

        #expect(read.map(\.start) == [Self.date("2026-01-05"), Self.date("2026-01-09")])
        #expect(read.map(\.end) == [Self.date("2026-01-09"), Self.date("2026-01-11")])
    }

    /// The claim that makes this a resolution pass rather than a sweep: the chain is written
    /// bottom-up, and it still resolves.
    @Test
    func `a chain resolves however it was ordered`() {
        let read = Self.tasks("""
        Third  :c, after b, 1d
        Second :b, after a, 1d
        First  :a, 2026-01-05, 1d
        """)

        #expect(read.map(\.start) == [
            Self.date("2026-01-07"), Self.date("2026-01-06"), Self.date("2026-01-05"),
        ])
    }

    /// Named after more than one, a task waits for the last of them — mermaid's own reading, and
    /// the only one that keeps `after` meaning "when its work can start".
    @Test
    func `a task after several waits for the latest`() {
        let read = Self.tasks("""
        Short :a, 2026-01-05, 1d
        Long  :b, 2026-01-05, 1w
        Both  :c, after a b, 1d
        """)

        #expect(read.last?.start == Self.date("2026-01-12"))
    }

    /// Weekends, by name. A five-day task starting on a Thursday runs Thursday, Friday, Monday,
    /// Tuesday and Wednesday, so it ends the following Wednesday — the bar is drawn to the
    /// Thursday boundary after it.
    @Test
    func `an excluded weekend moves the end of a task that spans it`() {
        let read = Self.tasks("""
        excludes weekends
        Thursday start : 2026-01-01, 5d
        """)

        #expect(read.first?.start == Self.date("2026-01-01"))
        #expect(read.first?.end == Self.date("2026-01-08"))
    }

    /// A named date is excluded exactly as a weekend is, read at the source's own `dateFormat`.
    @Test
    func `a named date is excluded too`() {
        let read = Self.tasks("""
        excludes 2026-01-06, 2026-01-07
        A week : 2026-01-05, 3d
        """)

        #expect(read.first?.end == Self.date("2026-01-10"))
    }

    /// The decision this ticket asks for, stated: a task told to start on a day nothing happens
    /// starts on the next day something can. The source excluded the day, so a bar beginning on
    /// it would draw work the chart says is impossible.
    @Test
    func `a task starting on an excluded day starts on the next working one`() {
        let read = Self.tasks("""
        excludes weekends
        Saturday start : 2026-01-03, 2d
        """)

        #expect(read.first?.start == Self.date("2026-01-05"))
        #expect(read.first?.end == Self.date("2026-01-07"))
    }

    /// The two compose, and in this order: the predecessor's end is its REAL end, and the
    /// dependent is then moved off the excluded day that end lands on.
    @Test
    func `a dependent starts after its predecessor's real end`() {
        let read = Self.tasks("""
        excludes weekends
        Runs into the weekend :a, 2026-01-01, 2d
        Follows it            :b, after a, 1d
        """)

        // Thursday plus two working days ends on the Saturday boundary, which is excluded, so
        // what follows opens on the Monday rather than in the weekend.
        #expect(read.first?.end == Self.date("2026-01-03"))
        #expect(read.last?.start == Self.date("2026-01-05"))
        #expect(read.last?.end == Self.date("2026-01-06"))
    }

    /// An end the source WROTE is where the bar ends, exclusions or not. Only a length is counted
    /// in working days; a stated date is a fact about the chart, not arithmetic to redo.
    @Test
    func `an excluded day does not move an end the source stated`() {
        let read = Self.tasks("""
        excludes weekends
        Stated : 2026-01-01, 2026-01-06
        """)

        #expect(read.first?.end == Self.date("2026-01-06"))
    }

    /// Every way these two go wrong. Each draws SOMETHING under a looser reader — a bar at a date
    /// nobody wrote, a chain silently cut, a `excludes` line quietly ignored — and this epic has
    /// been caught by a phantom drawn instead of a refusal six times.
    @Test(arguments: [
        // An `after` naming nothing that exists.
        "Orphan :after nobody, 1d",
        // A cycle, at every length: unreadable source rather than a hang.
        "Loop :a, after a, 1d",
        "One :a, after b, 1d\nTwo :b, after a, 1d",
        "One :a, after b, 1d\nTwo :b, after c, 1d\nThree :c, after a, 1d",
        // Two tasks answering to one name: which one `after a` meant is not a thing to guess.
        "One :a, 2026-01-05, 1d\nTwo :a, 2026-01-06, 1d\nThree :after a, 1d",
        // An `after` with no id at all, and one whose id is not one.
        "Nameless :after, 1d",
        "Punctuated :after a.b, 1d",
        // An `excludes` naming something this reader cannot turn into days.
        "excludes bank holidays\nAny : 2026-01-05, 1d",
        "excludes 2026-02-30\nAny : 2026-01-05, 1d",
        "excludes\nAny : 2026-01-05, 1d",
        // A chart on which no work can ever happen: every task would walk forever.
        "excludes monday, tuesday, wednesday, thursday, friday, saturday, sunday\n"
            + "Any : 2026-01-05, 1d",
    ])
    func `a chain or an exclusion this reader cannot resolve stays a fence`(body: String) {
        #expect(Self.read(body) == nil)
    }

    /// A weekday by its own name, which is what `excludes` is mostly written with.
    @Test
    func `a weekday can be excluded by name`() {
        let read = Self.tasks("""
        excludes friday
        Across a Friday : 2026-01-05, 5d
        """)

        #expect(read.first?.end == Self.date("2026-01-11"))
    }
}

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
}
