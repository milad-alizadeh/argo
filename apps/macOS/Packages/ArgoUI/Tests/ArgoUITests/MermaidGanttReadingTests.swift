@testable import ArgoUI
import Foundation
import Testing

/// What a Gantt source says, and — half the suite — what it refuses to say. A date this reader
/// cannot parse leaves the block the fence it is today (#903).
@Suite("Mermaid gantt reading")
struct MermaidGanttReadingTests {
    /// The calendar every expected date below is written in: UTC and Gregorian, so the suite
    /// asserts the same instants on a machine in Auckland as on one in London.
    private static func date(_ text: String) -> Date? {
        MermaidGanttClock.date(text, at: "yyyy-MM-dd HH:mm")
    }

    private static func read(_ body: String) -> MermaidGantt? {
        MermaidGantt.read("gantt\n" + body)
    }

    private static func tasks(_ body: String) -> [MermaidGantt.Task] {
        read(body)?.sections.flatMap(\.tasks) ?? []
    }

    @Test
    func `a chart reads its title, its sections and its tasks`() {
        let chart = Self.read("""
        title The mermaid epic
        dateFormat YYYY-MM-DD
        section Reading
          The reader : 2026-01-05, 2026-01-09
          The dates  : 2026-01-09, 3d
        section Drawing
          The axis   : 2026-01-12, 1w
        """)

        #expect(chart?.title == "The mermaid epic")
        #expect(chart?.sections.map(\.name) == ["Reading", "Drawing"])
        #expect(chart?.sections.first?.tasks.map(\.name) == ["The reader", "The dates"])
    }

    /// The two absolute forms this slice owns, against dates worked out by hand rather than by
    /// the arithmetic under test.
    @Test
    func `an explicit range and a duration both place a task`() {
        let read = Self.tasks("""
        dateFormat YYYY-MM-DD
        Ranged   : 2026-01-05, 2026-01-09
        Days     : 2026-01-05, 4d
        Weeks    : 2026-01-05, 2w
        """)

        #expect(read.map(\.start) == [Self.date("2026-01-05 00:00")].flatMap { [$0, $0, $0] })
        #expect(read.map(\.end) == [
            Self.date("2026-01-09 00:00"),
            Self.date("2026-01-09 00:00"),
            Self.date("2026-01-19 00:00"),
        ])
    }

    /// A `dateFormat` really is the input grammar: the same digits mean a different day under a
    /// different one.
    @Test
    func `the input grammar is honoured`() {
        let read = Self.tasks("dateFormat DD-MM-YYYY\nBritish : 05-01-2026, 1d")

        #expect(read.first?.start == Self.date("2026-01-05 00:00"))
    }

    @Test
    func `a task carrying an id keeps it, and one without has none`() {
        let read = Self.tasks("""
        dateFormat YYYY-MM-DD
        Named   :a1, 2026-01-05, 1d
        Unnamed :2026-01-05, 1d
        """)

        #expect(read.map(\.id) == ["a1", ""])
    }

    /// Time is a grammar too, and a chart inside one day is one this slice draws.
    @Test
    func `a chart can span hours rather than days`() {
        let read = Self.tasks("""
        dateFormat YYYY-MM-DD HH:mm
        Morning : 2026-01-05 09:00, 2026-01-05 12:30
        """)

        #expect(read.first?.start == Self.date("2026-01-05 09:00"))
        #expect(read.first?.end == Self.date("2026-01-05 12:30"))
    }

    /// Every refusal about a task's DATES in one place — the ones about its states are next door,
    /// in `MermaidGanttStateTests`. Each of these draws SOMETHING under a looser reader: a bar at a
    /// date nobody wrote, a heading over nothing. A wrong chart is worse than a fence.
    @Test(arguments: [
        "",
        "dateFormat YYYY-MM-DD",
        "dateFormat YYYY-MM-DD\nsection Empty",
        "dateFormat YYYY-MM-DD\nBad : 2026-13-45, 1d",
        // A day that does not exist in ITS month. The formatter rolls these forward rather than
        // refusing them — `2026-02-30` is the 2nd of March and `2026-04-31` the 1st of May — so
        // without the write-back each would draw a bar starting on a date nobody wrote.
        "dateFormat YYYY-MM-DD\nFeb work : 2026-02-30, 5d",
        "dateFormat YYYY-MM-DD\nApr work : 2026-04-31, 5d",
        "dateFormat YYYY-MM-DD\nNot a leap year : 2026-02-29, 1d",
        "dateFormat YYYY-MM-DD\nBad : not-a-date, 1d",
        "dateFormat YYYY-MM-DD\nBackwards : 2026-01-09, 2026-01-05",
        "dateFormat YYYY-MM-DD\nNo end : 2026-01-05",
        "dateFormat YYYY-MM-DD\nUnknown length : 2026-01-05, 3fortnights",
        "dateFormat QQQQ\nAny : 2026-01-05, 1d",
        "axisFormat %q\nAny : 2026-01-05, 1d",
        // `after` and `excludes` are read now (#904); what still fences is an `after` naming
        // nothing, which `MermaidGanttChainTests` owns along with the rest of the chain.
        "dateFormat YYYY-MM-DD\nAfter it :after a1, 5d",
        "dateFormat YYYY-MM-DD\n: 2026-01-05, 1d",
        "dateFormat YYYY-MM-DD\nNo colon 2026-01-05 1d",
    ])
    func `a source this slice cannot read stays a fence`(body: String) {
        #expect(Self.read(body) == nil)
        #expect(MermaidDiagram.read("gantt\n" + body) == nil)
    }

    /// A section with nothing under it is dropped rather than drawn: a heading over no bar is a
    /// row the source never asked for.
    @Test
    func `an empty section is not a heading over nothing`() {
        let chart = Self.read("""
        dateFormat YYYY-MM-DD
        section Nothing here
        section Something
          A task : 2026-01-05, 1d
        """)

        #expect(chart?.sections.map(\.name) == ["Something"])
    }

    /// Mermaid puts a task written before the first `section` in an unnamed one, and an unnamed
    /// section writes no heading.
    @Test
    func `a task before any section stands under no heading`() {
        let chart = Self.read("dateFormat YYYY-MM-DD\nLoose : 2026-01-05, 1d")

        #expect(chart?.sections.count == 1)
        #expect(chart?.rows.count == 1)
    }

    @Test
    func `the span is the range the tasks really cover`() {
        let chart = Self.read("""
        dateFormat YYYY-MM-DD
        Late  : 2026-03-01, 2026-03-05
        Early : 2026-01-05, 2026-01-09
        """)

        #expect(chart?.span?.lowerBound == Self.date("2026-01-05 00:00"))
        #expect(chart?.span?.upperBound == Self.date("2026-03-05 00:00"))
    }

    /// One instant written as a NUMBER rather than through the clock under test. Every other date
    /// here is read by `MermaidGanttClock`, so dropping its UTC pin would shift the expectation and
    /// the answer together and the suite would stay green; this is what reds.
    @Test
    func `midnight is midnight in UTC, whatever the machine is set to`() {
        let chart = Self.read("dateFormat YYYY-MM-DD\nPinned : 2026-01-05, 1d")

        #expect(chart?.span?.lowerBound.timeIntervalSince1970 == 1_767_571_200)
    }

    /// dayjs' own units, which mermaid inherited — `m` a minute and `M` a month, and the case is
    /// the whole difference.
    @Test
    func `every duration unit mermaid writes is read`() {
        let read = Self.tasks("""
        dateFormat YYYY-MM-DD HH:mm
        Minutes : 2026-01-05 00:00, 30m
        Months  : 2026-01-05 00:00, 2M
        Years   : 2026-01-05 00:00, 1y
        """)

        #expect(read.map(\.end) == [
            Self.date("2026-01-05 00:30"),
            Self.date("2026-03-05 00:00"),
            Self.date("2027-01-05 00:00"),
        ])
    }
}
