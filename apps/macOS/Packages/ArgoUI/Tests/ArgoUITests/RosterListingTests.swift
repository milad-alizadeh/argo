@testable import ArgoUI
import Testing

/// The roster pipeline: project, hold, search — in that order, which is the whole of it. A
/// pipeline reordered by accident produces a roster that still renders, so these are the claims
/// that catch it.
@Suite("Roster listing")
struct RosterListingTests {
    // MARK: - Order before search

    /// Filtered AFTER the order is published, so a query cannot re-order what it leaves behind.
    @Test
    func `a query does not re-order the rows it keeps`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "one", "two", "three"), matching: ""))

        // The activity order has since flipped, and a query keeps two of the three.
        let searched = roster.reading(of: sessions(named: "three", "two", "one"), matching: "e")

        #expect(searched.rows.map(\.id) == ["one", "three"])
    }

    /// The hold covers the WHOLE roster and not only the rows a query kept — otherwise clearing
    /// the search would hand back a list nothing was holding.
    @Test
    func `a hold taken while a query is narrowing still covers the rows it hid`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "alpha", "beta", "gamma"), matching: "a"))

        let cleared = roster.reading(of: sessions(named: "gamma", "beta", "alpha"), matching: "")

        #expect(cleared.rows.map(\.id) == ["alpha", "beta", "gamma"])
    }

    @Test
    func `an unheld roster is the activity order`() {
        let roster = RosterListing()
        let reading = roster.reading(of: sessions(named: "gamma", "alpha"), matching: "")

        #expect(reading.rows.map(\.id) == ["gamma", "alpha"])
    }

    @Test
    func `releasing re-settles the roster to the activity order`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "alpha", "beta"), matching: ""))
        roster.release()

        let reading = roster.reading(of: sessions(named: "beta", "alpha"), matching: "")

        #expect(reading.rows.map(\.id) == ["beta", "alpha"])
    }

    /// The drift `admit` exists to stop: an admitted row is placed from an activity order that
    /// keeps moving, so without recording the placement the one row the freeze let in is the one
    /// row that travels.
    @Test
    func `a Session admitted while held stays where it was put`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "alpha", "beta"), matching: ""))

        let arrived = roster.reading(of: sessions(named: "new", "alpha", "beta"), matching: "")
        roster.admit(arrived)

        // "new" has since gone quiet and sorts last; the held order does not re-place it.
        let later = roster.reading(of: sessions(named: "alpha", "beta", "new"), matching: "")

        #expect(later.rows.map(\.id) == ["new", "alpha", "beta"])
    }

    // MARK: - The archived list

    /// A search that stopped at the fold would answer "no Sessions" about a list it never looked
    /// in.
    @Test
    func `the same query filters the list behind the fold`() {
        let roster = RosterListing()
        let reading = roster.reading(of: archived(named: "alpha", "beta"), matching: "alpha")

        #expect(reading.archived.map(\.id) == ["alpha"])
    }

    /// Not held by the order above: nothing behind the fold is under the pointer, so there is no
    /// swap to refuse.
    @Test
    func `the list behind the fold follows the activity order even while the roster is held`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: archived(named: "alpha", "beta"), matching: ""))

        let reading = roster.reading(of: archived(named: "beta", "alpha"), matching: "")

        #expect(reading.archived.map(\.id) == ["beta", "alpha"])
    }

    @Test
    func `an archived Session is not on the roster`() {
        let roster = RosterListing()
        let mixed = sessions(named: "kept") + archived(named: "gone")

        #expect(roster.reading(of: mixed, matching: "").rows.map(\.id) == ["kept"])
    }

    @Test
    func `a Session still on the roster is not behind the fold`() {
        let roster = RosterListing()
        let mixed = sessions(named: "kept") + archived(named: "gone")

        #expect(roster.reading(of: mixed, matching: "").archived.map(\.id) == ["gone"])
    }

    // MARK: - What a hold is taken over

    /// The hold and the admit are both taken over the PUBLISHED roster, whole — which is the one
    /// thing the caller used to have to get right twice.
    @Test
    func `the ids a hold is taken over are the whole published roster`() {
        let roster = RosterListing()
        let reading = roster.reading(of: sessions(named: "alpha", "beta"), matching: "alpha")

        #expect(reading.rows.map(\.id) == ["alpha"])
        #expect(reading.ids == ["alpha", "beta"])
    }

    // MARK: - Fixtures

    private func sessions(named ids: String...) -> [CockpitPresentation.Session] {
        ids.map { session(id: $0, isArchived: false) }
    }

    private func archived(named ids: String...) -> [CockpitPresentation.Session] {
        ids.map { session(id: $0, isArchived: true) }
    }

    /// The id is also the title, so a query matches the row the test names.
    private func session(id: String, isArchived: Bool) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: id,
            access: .managed,
            status: .idle,
            annotations: .init(isArchived: isArchived),
        )
    }
}
