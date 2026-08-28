@testable import ArgoUI
import Foundation
import Testing

/// What a bar SAYS: the states a task carries, and the mark each of them draws (#905).
@MainActor
@Suite("Mermaid gantt states")
struct MermaidGanttStateTests {
    private static func tasks(_ body: String) -> [MermaidGantt.Task] {
        MermaidGantt.read("gantt\ndateFormat YYYY-MM-DD\n" + body)?
            .sections.flatMap(\.tasks) ?? []
    }

    private static func plan(_ body: String) -> MermaidPlan {
        MermaidGantt.read("gantt\ndateFormat YYYY-MM-DD\n" + body)?.laid ?? .empty
    }

    /// The marks a task draws, in the order the plan lays them down — the scale is dropped, so
    /// what is left is what the tasks themselves say.
    private static func marks(of plan: MermaidPlan) -> [MermaidFigure] {
        plan.figures.filter { $0.role != .axis }
    }

    @Test
    func `each state a task can carry is read`() {
        let read = Self.tasks("""
        Plain     : 2026-01-05, 1w
        Finished  :done, 2026-01-05, 1w
        Running   :active, 2026-01-05, 1w
        Critical  :crit, 2026-01-05, 1w
        A marker  :milestone, 2026-01-05, 0d
        """)

        #expect(read.map(\.states) == [[], [.done], [.active], [.crit], [.milestone]])
    }

    /// Mermaid writes them as a list, so the reader takes a SET rather than one value.
    @Test
    func `states combine, before an id and before the dates alike`() {
        let read = Self.tasks("""
        Both    :crit, active, 2026-01-05, 1w
        Named   :crit, active, a1, 2026-01-05, 1w
        Marker  :crit, milestone, m1, 2026-01-05, 0d
        """)

        #expect(read.map(\.states) == [[.crit, .active], [.crit, .active], [.crit, .milestone]])
        #expect(read.map(\.id) == ["", "a1", "m1"])
    }

    /// Every state refusal in one place. Each of these draws SOMETHING under a looser reader — a
    /// bar that says the task is ordinary where the source said it was critical, a marker at one
    /// end of a range nobody asked for — and a wrong chart is worse than a fence.
    @Test(arguments: [
        // An unrecognised state word, WITH an id after it. Dropping it would draw a plain bar over
        // a source that said something about the task. Written without the id — `urgent,
        // 2026-01-05, 5d` — it is taken as the id instead and a plain bar is right, which is
        // mermaid's own reading and the one place this set stops.
        "Unknown  :crit, urgent, a1, 2026-01-05, 5d",
        // A state written after the id it is meant to stand in front of.
        "Late     :a1, done, 2026-01-05, 5d",
        // The same state twice: a set would swallow the second silently.
        "Twice    :crit, crit, 2026-01-05, 5d",
        // Finished AND in flight. Picking either draws a bar the source did not write.
        "Both     :done, active, 2026-01-05, 5d",
        // A milestone is a POINT. Given a length, the source is saying two things, and drawing
        // the marker at either end of the range drops the other.
        "Spanning :milestone, 2026-01-05, 5d",
    ])
    func `a state this reader cannot read stays a fence`(body: String) {
        #expect(MermaidGantt.read("gantt\ndateFormat YYYY-MM-DD\n" + body) == nil)
    }

    /// The dimension the ticket is about: one hue per section, laid down at three strengths, so
    /// done → plain → active reads as a scale rather than as three categories.
    @Test
    func `done, plain and active are one hue at three weights`() {
        let marks = Self.marks(of: Self.plan("""
        Finished :done, 2026-01-05, 1w
        Plain    : 2026-01-12, 1w
        Running  :active, 2026-01-19, 1w
        """))

        #expect(marks.map(\.role) == [.series(0), .series(0), .series(0)])
        #expect(marks.map(\.weight) == [.spent, .ordinary, .full])
    }

    /// `crit` cannot be a rung of that scale, because the source writes `crit, active` and a rung
    /// holds one value. It is a ring round the mark, in the diagram's own call-out role.
    @Test
    func `a critical task is ringed rather than recoloured`() {
        let marks = Self.marks(of: Self.plan("Critical :crit, active, 2026-01-05, 1w"))

        #expect(marks.count == 2)
        #expect(marks.first?.role == .series(0))
        #expect(marks.first?.weight == .full)
        #expect(marks.last?.role == .emphasis)
        // The ring stands round the fill rather than on its edge, so it is read against the deck
        // and not against the hue it rings.
        guard case let .shape(.rounded, fill) = marks.first?.form,
              case let .shape(.rounded, ring) = marks.last?.form
        else {
            Issue.record("a fill inside a ring")
            return
        }
        #expect(ring.insetBy(dx: -1, dy: -1).contains(fill))
        #expect(fill.height < ring.height)
    }

    /// A bar broken around the days off is still ONE task saying one thing (#904 under #905).
    ///
    /// Every stretch takes the same weight and the same ring. A `done` task whose first run drew
    /// spent and whose rest drew ordinary would say the work restarted on the Monday, and a
    /// critical one ringed on its first run only would say the weekend let it off the path.
    @Test
    func `every run of a broken bar says what the whole task says`() {
        let plan = MermaidGantt.read("""
        gantt
        dateFormat YYYY-MM-DD
        excludes weekends
        Finished :done, 2026-01-01, 8d
        Critical :crit, active, 2026-01-01, 8d
        """)?.laid ?? .empty
        let marks = Self.marks(of: plan)
        let fills = marks.filter { $0.role == .series(0) }
        let rings = marks.filter { $0.role == .emphasis }

        // Two tasks, each broken into the same number of runs by the same weekends.
        #expect(fills.count > 2)
        #expect(fills.count == rings.count * 2)
        #expect(fills.prefix(rings.count).allSatisfy { $0.weight == .spent })
        #expect(fills.suffix(rings.count).allSatisfy { $0.weight == .full })
    }

    /// A milestone is a marker and not a bar: a square diamond standing on its own date, with no
    /// length along the axis at all.
    @Test
    func `a milestone draws a marker on its point of the axis`() {
        let marks = Self.marks(of: Self.plan("""
        A week   : 2026-01-05, 1w
        A marker :milestone, 2026-01-12, 0d
        """))

        guard case let .shape(.rounded, bar) = marks.first?.form,
              case let .shape(.diamond, marker) = marks.last?.form
        else {
            Issue.record("a bar and a marker")
            return
        }
        #expect(marker.width == marker.height)
        // A diamond covers half its box, so it takes the row's height rather than the bar's.
        #expect(marker.height > bar.height)
        // Centred ON its date, which is where the bar beside it ends.
        #expect(abs(marker.midX - bar.maxX) < 0.5)
    }
}
