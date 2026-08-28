@testable import ArgoUI
import Foundation
import Testing

/// Where a read pie chart is placed. The claims are the ones a reader would make with their eyes
/// on it: wedges around the circle in the order written and sized by share, a legend beside them
/// naming each one, and a title over the whole thing when there is one.
@MainActor
@Suite("Mermaid pie layout")
struct MermaidPieLayoutTests {
    static func plan(_ body: String) -> MermaidPlan {
        MermaidPie.read("pie\n" + body)?.laid ?? .empty
    }

    /// Every wedge the plan drew, in the order it drew them.
    static func wedges(of plan: MermaidPlan) -> [MermaidArc] {
        plan.figures.compactMap { figure in
            guard case let .arc(arc, _) = figure.form else { return nil }
            return arc
        }
    }

    @Test
    func `a wedge is drawn per slice, in the order the source wrote them`() {
        let plan = Self.plan("\"Read\" : 1\n\"Write\" : 1\n\"Land\" : 2")

        #expect(Self.wedges(of: plan).map(\.start) == [0, 0.25, 0.5])
        #expect(Self.wedges(of: plan).map(\.end) == [0.25, 0.5, 1])
    }

    /// Mermaid never asked a source to sum to a hundred, so the chart normalises rather than
    /// clipping the overflow or leaving a gap where the shortfall was.
    @Test(arguments: ["\"Read\" : 30\n\"Write\" : 10", "\"Read\" : 75\n\"Write\" : 25"])
    func `values that do not sum to a hundred still close the circle`(body: String) {
        let wedges = Self.wedges(of: Self.plan(body))

        #expect(wedges.map(\.start) == [0, 0.75])
        #expect(wedges.last?.end == 1)
    }

    @Test
    func `one slice is one wedge around the whole circle`() {
        #expect(Self.wedges(of: Self.plan("\"Read\" : 7")) == [MermaidArc(start: 0, end: 1)])
    }

    /// Nothing to divide by draws no wedge at all, and still draws the legend — the chart says
    /// what it was asked about, and says nothing about shares it cannot work out.
    @Test
    func `a chart of nothing but zeroes draws its legend and no wedge`() {
        let plan = Self.plan("\"Read\" : 0\n\"Write\" : 0")

        #expect(Self.wedges(of: plan).isEmpty)
        #expect(plan.captions.map(\.label.text) == ["Read", "Write", "0%", "0%"])
    }

    /// Every wedge stands in the same box, because they are one circle. Anything else would draw
    /// the pie as a scatter of arcs.
    @Test
    func `every wedge is inscribed in one circle`() {
        let boxes = Self.plan("\"Read\" : 1\n\"Write\" : 3").figures.compactMap { figure in
            guard case let .arc(_, rect) = figure.form else { return nil as CGRect? }
            return rect
        }

        #expect(Set(boxes).count == 1)
        #expect(boxes.first?.width == boxes.first?.height)
    }

    /// The captions the plan places and the labels the view builds are paired by POSITION, so the
    /// two lists saying the same words in the same order is the contract between them.
    @Test(arguments: [
        "\"Read\" : 1\n\"Write\" : 1",
        "title Where the time went\n\"Read\" : 1\n\"Write\" : 1",
    ])
    func `the captions are the model's labels, in that order`(body: String) {
        let pie = MermaidPie.read("pie\n" + body)

        #expect(pie?.laid.captions.map(\.label) == pie?.labels)
    }

    @Test
    func `the title is placed over the chart when there is one`() {
        let plan = Self.plan("title Where the time went\n\"Read\" : 1")

        #expect(plan.captions.first?.label.text == "Where the time went")
        #expect(plan.captions.first?.rect.minY == 0)
    }

    @Test
    func `an untitled chart places no caption for one`() {
        #expect(Self.plan("\"Read\" : 1").captions.map(\.label.text) == ["Read", "100%"])
    }

    /// The legend's swatch is what ties a name to a wedge, so the two have to take the same hue —
    /// which, since a role is never a colour here, means the same index.
    @Test
    func `a legend swatch takes the series of the wedge it names`() {
        let plan = Self.plan("\"Read\" : 1\n\"Write\" : 1")
        let swatches = plan.figures.filter {
            guard case .shape = $0.form else { return false }
            return true
        }

        #expect(swatches.map(\.role) == [.series(0), .series(1)])
        #expect(Self.arcRoles(of: plan) == [.series(0), .series(1)])
    }

    static func arcRoles(of plan: MermaidPlan) -> [MermaidRole] {
        plan.figures.compactMap { figure in
            guard case .arc = figure.form else { return nil }
            return figure.role
        }
    }

    /// `showData` adds the value the source wrote; the share is written either way, because a
    /// legend that names a slice without saying how big it is has not read the chart.
    @Test
    func `showData writes the value beside the share`() {
        #expect(Self.plan("\"Read\" : 3\n\"Write\" : 1").captions.map(\.label.text).suffix(2)
            == ["75%", "25%"])
        #expect(MermaidPie.read("pie showData\n\"Read\" : 3\n\"Write\" : 1")?
            .laid.captions.map(\.label.text).suffix(2) == ["3 · 75%", "1 · 25%"])
    }

    /// The plan is what the view frames itself at and what the lane reports, so a chart that laid
    /// out to nothing would be a row of no height (#860).
    @Test
    func `a chart stands at a size the view can frame`() {
        let size = Self.plan("\"Read\" : 1\n\"Write\" : 1").size

        #expect(size.width > MermaidMeasure.chartDiameter)
        #expect(size.height >= MermaidMeasure.chartDiameter)
    }
}
