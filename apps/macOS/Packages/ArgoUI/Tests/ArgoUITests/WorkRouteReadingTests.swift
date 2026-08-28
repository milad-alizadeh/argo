import ArgoEngine
@testable import ArgoUI
import Testing

/// What a Route stop SAYS, and what it refuses to say (#335).
///
/// Every rendered word is the tracker's own — the status word verbatim, the tag off the ticket's
/// own type or label. Where a provider served nothing, the stop falls back to Argo's neutral bucket
/// name rather than inventing vocabulary, and where it served no edges the placement degrades to
/// one takeable column instead of failing.
@Suite("A Route stop speaks the tracker's words")
struct WorkRouteReadingTests {
    @Test
    func `the provider's status word renders verbatim`() throws {
        let route = try #require(WorkFixture.chartRoom.chart?.route)

        #expect(word(of: 609, in: route) == "In progress")
        #expect(word(of: 388, in: route) == "In progress")
        #expect(word(of: 690, in: route) == "Done")
    }

    /// A ticket the provider named and said nothing else about. `open` is Argo's own bucket, and it
    /// is a FALLBACK — a ticket carrying a word renders that word however Argo would file it.
    @Test
    func `a ticket with no status word falls back to Argo's bucket`() throws {
        let parent = Self.node(1, children: [2])
        let wordless = WorkItem(number: 2, title: "#2", status: "", closure: .open)
        let route = try #require(WorkRoomProjection.route(of: parent, among: [parent, wordless]))

        #expect(route.stops.first?.word == "open")
    }

    /// The same ticket while a Session holds it. The bucket is the pair of facts it is built from —
    /// the provider's closure and Argo's own claim — so the fallback moves with the claim.
    @Test
    func `a claimed ticket with no word falls back to claimed`() throws {
        let parent = Self.node(1, children: [2])
        let wordless = WorkItem(number: 2, title: "#2", status: "", closure: .open)
        let route = try #require(
            WorkRoomProjection.route(of: parent, among: [parent, wordless], claimed: [2]),
        )

        #expect(route.stops.first?.word == "claimed")
    }

    /// The provider's own TYPE word wins the tag even over labels that read like one — which is
    /// what makes the view read correctly over a planning parent. #272 is typed `task` and labelled
    /// `work-room · ui · blocked`, and the type is what a dot wears.
    @Test
    func `a typed ticket wears its type, not one of its labels`() throws {
        let route = try #require(WorkFixture.chartRoom.chart?.route)

        #expect(tag(of: 272, in: route) == "task")
        #expect(tag(of: 334, in: route) == "PRD")
    }

    /// A child the provider only LABELLED wears its first label instead, which is what makes the
    /// same view read over a spec whose sub-tickets carry triage labels rather than planning types.
    ///
    /// The first label and not a triage-shaped one: Argo does not classify a provider's labels, so
    /// reaching for one by pattern would be Argo ranking somebody else's topics (#160).
    @Test
    func `an untyped ticket wears its first label`() throws {
        let parent = Self.node(1, children: [2, 3])
        let triaged = WorkItem(
            number: 2, title: "#2", status: "Todo", closure: .open,
            labels: ["ready-for-agent", "ui"],
        )
        let bare = WorkItem(number: 3, title: "#3", status: "Todo", closure: .open)
        let route = try #require(
            WorkRoomProjection.route(of: parent, among: [parent, triaged, bare]),
        )

        #expect(tag(of: 2, in: route) == "ready-for-agent")
        #expect(tag(of: 3, in: route) == nil)
    }

    /// A dependency cycle RESOLVES. It resolves to the wrong column — a ring has no honest distance
    /// to the line — and #338 is what names it out loud; what matters here is that it terminates
    /// rather than recursing without bound.
    @Test
    func `a dependency cycle resolves rather than recursing`() throws {
        let parent = Self.node(1, children: [2, 3])
        let ring = [
            Self.node(2, blockedBy: [WorkItemBlocker(number: 3, closure: .open)]),
            Self.node(3, blockedBy: [WorkItemBlocker(number: 2, closure: .open)]),
        ]
        let route = try #require(WorkRoomProjection.route(of: parent, among: [parent] + ring))

        #expect(route.stops.count == 2)
        #expect(route.stops.allSatisfy { $0.zone == .ahead })
    }

    /// A provider that exposes no dependency information at all. `blockedBy` is ABSENT rather than
    /// empty, which is unknown and not "no blockers" — and an unknown distance degrades down to the
    /// nearest column, so the whole route collapses to one takeable column and still renders.
    @Test
    func `a provider with no edges collapses to one takeable column`() throws {
        let route = try #require(WorkFixture.edgelessChartRoom.chart?.route)

        #expect(route.stops(in: .ahead).isEmpty)
        #expect(route.reach == 0)
        #expect(!route.stops(in: .now).isEmpty)
    }

    /// A blocker the poll never reached is an unknown distance too, on the same terms: the
    /// dependent stands one column out — it IS blocked — rather than inheriting a depth nobody
    /// read.
    @Test
    func `a blocker outside the listing puts its dependent one column out`() throws {
        let parent = Self.node(1, children: [2])
        let child = Self.node(2, blockedBy: [WorkItemBlocker(number: 99, closure: .open)])
        let route = try #require(WorkRoomProjection.route(of: parent, among: [parent, child]))

        #expect(route.stops.first?.zone == .ahead)
        #expect(route.stops.first?.column == 1)
    }

    /// A ruled-out blocker satisfies nothing, so its dependent is never offered as takeable. Argo
    /// disagrees with the GitHub and Linear UIs here, and this is where that shows on the axis.
    @Test
    func `a ruled-out blocker keeps its dependent ahead of the line`() throws {
        let parent = Self.node(1, children: [2])
        let child = Self.node(2, blockedBy: [WorkItemBlocker(number: 3, closure: .ruledOut)])
        let route = try #require(WorkRoomProjection.route(of: parent, among: [parent, child]))

        #expect(route.stops.first?.zone == .ahead)
    }

    private func word(of number: Int, in route: WorkRoomProjection.Route) -> String? {
        route.stops.first { $0.id == number }?.word
    }

    private func tag(of number: Int, in route: WorkRoomProjection.Route) -> String? {
        route.stops.first { $0.id == number }?.tag
    }

    private static func node(
        _ number: Int,
        blockedBy: [WorkItemBlocker] = [],
        children: [Int] = [],
    )
        -> WorkItem {
        WorkRoutePlacementTests.node(number, blockedBy: blockedBy, children: children)
    }
}
