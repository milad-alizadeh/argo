@testable import ArgoUI
import Testing

/// The roster pipeline: project, then hold — which is the whole of it. A pipeline reordered by
/// accident produces a roster that still renders, so these are the claims that catch it.
@Suite("Roster listing")
struct RosterListingTests {
    // MARK: - The published order

    @Test
    func `an unheld roster is the activity order`() {
        let roster = RosterListing()
        let reading = roster.reading(of: sessions(named: "gamma", "alpha"))

        #expect(reading.rows.map(\.id) == ["gamma", "alpha"])
    }

    @Test
    func `a held roster does not re-order under a change in activity`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "one", "two", "three")))

        let later = roster.reading(of: sessions(named: "three", "two", "one"))

        #expect(later.rows.map(\.id) == ["one", "two", "three"])
    }

    @Test
    func `releasing re-settles the roster to the activity order`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "alpha", "beta")))
        roster.release()

        let reading = roster.reading(of: sessions(named: "beta", "alpha"))

        #expect(reading.rows.map(\.id) == ["beta", "alpha"])
    }

    /// The drift `admit` exists to stop: an admitted row is placed from an activity order that
    /// keeps moving, so without recording the placement the one row the freeze let in is the one
    /// row that travels.
    @Test
    func `a Session admitted while held stays where it was put`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "alpha", "beta")))

        let arrived = roster.reading(of: sessions(named: "new", "alpha", "beta"))
        roster.admit(arrived)

        // "new" has since gone quiet and sorts last; the held order does not re-place it.
        let later = roster.reading(of: sessions(named: "alpha", "beta", "new"))

        #expect(later.rows.map(\.id) == ["new", "alpha", "beta"])
    }

    /// Three Sessions started one after the other, which is how the roster was reported
    /// reshuffling (#1236): each publish brings a new row AND a moved activity order for the rows
    /// already on, and not one of those rows may change place.
    @Test
    func `three Sessions starting one after the other leave the roster order still`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: sessions(named: "alpha", "beta", "gamma")))

        let publishes = [
            ["one", "gamma", "alpha", "beta"],
            ["two", "beta", "one", "gamma", "alpha"],
            ["three", "gamma", "alpha", "two", "beta", "one"],
        ]
        let onBefore = ["alpha", "beta", "gamma"]

        for activity in publishes {
            let reading = roster.reading(of: sessions(named: activity))

            #expect(reading.ids.filter(onBefore.contains) == onBefore)

            roster.admit(reading)
        }

        // And each of the three took its place once: a publish that sorts them last moves nothing.
        let settled = roster.reading(of: sessions(named: [
            "alpha", "beta", "gamma", "one", "two", "three",
        ]))

        #expect(settled.ids == ["three", "two", "one", "alpha", "beta", "gamma"])
    }

    // MARK: - The archived list

    /// Not held by the order above: nothing behind the fold is under the pointer, so there is no
    /// swap to refuse.
    @Test
    func `the list behind the fold follows the activity order even while the roster is held`() {
        var roster = RosterListing()
        roster.hold(roster.reading(of: archived(named: "alpha", "beta")))

        let reading = roster.reading(of: archived(named: "beta", "alpha"))

        #expect(reading.archived.map(\.id) == ["beta", "alpha"])
    }

    @Test
    func `an archived Session is not on the roster`() {
        let roster = RosterListing()
        let mixed = sessions(named: "kept") + archived(named: "gone")

        #expect(roster.reading(of: mixed).rows.map(\.id) == ["kept"])
    }

    @Test
    func `a Session still on the roster is not behind the fold`() {
        let roster = RosterListing()
        let mixed = sessions(named: "kept") + archived(named: "gone")

        #expect(roster.reading(of: mixed).archived.map(\.id) == ["gone"])
    }

    // MARK: - What a hold is taken over

    /// The hold and the admit are both taken over the PUBLISHED roster, whole — which is the one
    /// thing the caller used to have to get right twice.
    @Test
    func `the ids a hold is taken over are the whole published roster`() {
        let roster = RosterListing()
        let reading = roster.reading(of: sessions(named: "alpha", "beta"))

        #expect(reading.ids == ["alpha", "beta"])
    }

    // MARK: - Fixtures

    private func sessions(named ids: String...) -> [CockpitPresentation.Session] {
        sessions(named: ids)
    }

    private func sessions(named ids: [String]) -> [CockpitPresentation.Session] {
        ids.map { session(id: $0, isArchived: false) }
    }

    private func archived(named ids: String...) -> [CockpitPresentation.Session] {
        ids.map { session(id: $0, isArchived: true) }
    }

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
