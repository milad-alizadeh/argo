@testable import ArgoUI
import Testing

/// Where the roster's offset goes when a Session lands at its head (#1235).
///
/// The state this refuses: a row arrives above the one at the top, the list keeps the offset it
/// had, and the reader is left in the middle of the roster with the arriving row cut in half under
/// the rooms picker — the Session it was announcing, unreadable.
@Suite("Roster top")
struct RosterTopTests {
    @Test
    func `a Session arriving at the head brings a roster at the top back to the top`() {
        let top = SessionRosterProjection.topRow(
            whenHeadMovedFrom: "one",
            to: "arrived",
            isAtTop: true,
        )

        #expect(top == "arrived")
    }

    /// The reader owns the offset. Moving the rows under their pointer to announce somebody else's
    /// Session is worse than not announcing it.
    @Test
    func `a scrolled roster is left where the reader put it`() {
        let top = SessionRosterProjection.topRow(
            whenHeadMovedFrom: "one",
            to: "arrived",
            isAtTop: false,
        )

        #expect(top == nil)
    }

    @Test
    func `a roster whose head did not move does not scroll`() {
        let top = SessionRosterProjection.topRow(whenHeadMovedFrom: "one", to: "one", isAtTop: true)

        #expect(top == nil)
    }

    /// The first pass has no previous head, and a list that has drawn nothing yet is at its top
    /// already — a scroll there would be the mount announcing itself.
    @Test
    func `the first roster drawn does not scroll`() {
        let top = SessionRosterProjection.topRow(whenHeadMovedFrom: nil, to: "one", isAtTop: true)

        #expect(top == nil)
    }

    /// An emptied roster has no row to scroll to. Nothing is asked of the list.
    @Test
    func `a roster that lost its last row does not scroll`() {
        let top = SessionRosterProjection.topRow(whenHeadMovedFrom: "one", to: nil, isAtTop: true)

        #expect(top == nil)
    }
}
