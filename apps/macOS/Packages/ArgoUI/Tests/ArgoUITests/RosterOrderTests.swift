@testable import ArgoUI
import Testing

@Suite("Roster order")
struct RosterOrderTests {
    @Test
    func `an unheld order is the activity order`() {
        let order = RosterOrder()

        #expect(order.isHolding == false)
        #expect(order.published(["b", "a", "c"]) == ["b", "a", "c"])
    }

    @Test
    func `a held order does not reshuffle when the activity order moves`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])

        #expect(order.published(["c", "b", "a"]) == ["a", "b", "c"])
        #expect(order.published(["b", "c", "a"]) == ["a", "b", "c"])
    }

    /// Engagement is reported by pointer and by keyboard, and both arrive. The second must not
    /// re-snapshot: that would let exactly one reshuffle through per signal.
    @Test
    func `holding twice keeps the order the first hold took`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])
        order.hold(["c", "b", "a"])

        #expect(order.published(["c", "b", "a"]) == ["a", "b", "c"])
    }

    @Test
    func `releasing re-settles to the activity order`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])
        order.release()

        #expect(order.isHolding == false)
        #expect(order.published(["c", "b", "a"]) == ["c", "b", "a"])
    }

    /// Freezing means rows do not swap, not that the list stops accepting members.
    @Test
    func `a Session arriving while held goes in at its sorted position`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])

        // Newest first, so a Session that just started sorts in front of everything.
        #expect(order.published(["new", "a", "b", "c"]) == ["new", "a", "b", "c"])
        // And one arriving mid-list lands between the rows the activity order puts it between,
        // rather than at the end.
        #expect(order.published(["a", "new", "b", "c"]) == ["a", "new", "b", "c"])
    }

    @Test
    func `two Sessions arriving at once keep their own order`() {
        var order = RosterOrder()
        order.hold(["a", "b"])

        #expect(order.published(["first", "second", "a", "b"]) == ["first", "second", "a", "b"])
    }

    @Test
    func `a Session that ends while held leaves`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])

        #expect(order.published(["c", "a"]) == ["a", "c"])
    }

    /// The drift the `admit` step exists to stop: an admitted row is placed from the activity
    /// order, and that order keeps moving — so without recording the placement, the one row the
    /// freeze let in would be the one row that travels.
    @Test
    func `an admitted Session stays where it was put`() {
        var order = RosterOrder()
        order.hold(["a", "b"])

        let published = order.published(["new", "a", "b"])
        order.admit(published)

        // "new" has since gone quiet and sorts last, but the held order does not re-place it.
        #expect(order.published(["a", "b", "new"]) == ["new", "a", "b"])
    }

    @Test
    func `admitting records nothing while the order is free`() {
        var order = RosterOrder()
        order.admit(["a", "b"])

        #expect(order.isHolding == false)
        #expect(order.published(["b", "a"]) == ["b", "a"])
    }

    @Test
    func `rows come back in the published order`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])

        let rows = ["c", "b", "a"].map(Stub.init(id:))

        #expect(order.published(rows).map(\.id) == ["a", "b", "c"])
    }

    private struct Stub: Identifiable {
        let id: String
    }
}
