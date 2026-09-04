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

    // MARK: - Several Sessions at once

    /// The reported bug (#1236): start three Sessions one after the other, and the rows already on
    /// the roster trade places while the new ones arrive.
    @Test
    func `three Sessions arriving over several publishes leave the rows already on still`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])

        // Each publish moves the activity order of the OLD rows as well as bringing a new one:
        // both agents keep writing records while a Session starts.
        let publishes = [
            ["one", "c", "a", "b"],
            ["two", "b", "one", "c", "a"],
            ["three", "a", "two", "c", "one", "b"],
        ]
        let onBefore = ["a", "b", "c"]

        for activity in publishes {
            let published = order.published(activity)

            #expect(published.filter(onBefore.contains) == onBefore)

            order.admit(published)
        }
    }

    /// A new row goes in at one place, and that place is never BETWEEN two rows the walk has
    /// already moved past: the activity order of the old rows moves under the walk, and a row
    /// wedged in behind it pushes everything below it down.
    @Test
    func `a Session arriving late does not wedge between rows the walk moved past`() {
        var order = RosterOrder()
        order.hold(["a", "b", "c"])

        // "c" has just spoken, so the activity order now runs c, a, b — and two Sessions start
        // into the middle of that walk.
        #expect(order.published(["c", "one", "a", "two", "b"]) == ["a", "b", "c", "one", "two"])
    }

    /// Three Sessions started one after the other, each admitted as it arrives: every one of them
    /// is placed once, and no later publish moves it.
    @Test
    func `each of three admitted Sessions is placed once and never moved`() {
        var order = RosterOrder()
        order.hold(["a", "b"])

        // Each Session starts into an activity order that has moved since the last publish.
        for activity in [
            ["one", "a", "b"],
            ["two", "b", "one", "a"],
            ["three", "a", "two", "b", "one"],
        ] {
            order.admit(order.published(activity))
        }

        // All three have since gone quiet and sort last; not one of them is re-placed.
        let placed = ["three", "two", "one", "a", "b"]

        #expect(order.published(["a", "b", "one", "two", "three"]) == placed)
        #expect(order.published(["b", "two", "a", "three", "one"]) == placed)
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
