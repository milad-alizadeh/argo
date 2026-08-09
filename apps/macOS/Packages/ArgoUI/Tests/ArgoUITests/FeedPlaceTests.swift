@testable import ArgoUI
import SwiftUI
import Testing

/// Whose authority the reader's place answers to while the column is being resized.
///
/// `.scrollPosition(id:)` is a two-way binding: the scroller re-elects the topmost row as the
/// layout changes and writes it back. That is right while the reader is scrolling and wrong while a
/// seam is moving — a drag re-wraps every visible row sixty times a second, so each frame elects a
/// different row, each election re-lays the column out, and the next frame elects another. The
/// reading shakes for as long as the seam is held.
///
/// Holding the standing row is what #476 meant by anchoring to a row: the place survives the
/// remeasure BECAUSE nothing is allowed to re-decide it mid-remeasure.
@Suite("Feed place")
struct FeedPlaceTests {
    @Test
    func `a still column takes the row the scroller elected`() {
        #expect(FeedPlace.held(3, proposed: 7, whileResizing: false) == 7)
    }

    @Test
    func `a moving seam leaves the reader on the row they were on`() {
        #expect(FeedPlace.held(3, proposed: 7, whileResizing: true) == 3)
    }

    /// The case that produced the shake: a re-election every frame, none of which may land.
    @Test
    func `no sequence of elections moves the place while the seam is held`() {
        let standing: FeedRow.ID? = 12
        let elections: [FeedRow.ID?] = [11, 13, 12, 14, nil, 10]

        let ended = elections.reduce(standing) { place, proposed in
            FeedPlace.held(place, proposed: proposed, whileResizing: true)
        }

        #expect(ended == standing)
    }

    /// A feed with nothing in it has no place to hold, and holding `nil` must not become a claim
    /// that the reader is at the top.
    @Test
    func `an unplaced reading stays unplaced`() {
        #expect(FeedPlace.held(nil, proposed: nil, whileResizing: false) == nil)
        #expect(FeedPlace.held(nil, proposed: 4, whileResizing: true) == nil)
    }

    /// A following reading reports NO place, whatever row it is standing on. The binding writes as
    /// well as reads: reporting one while the Session is appending puts the topmost row back over
    /// the offset each arriving row had just moved.
    @Test
    func `a following reading reports no place at all`() {
        var standing: FeedRow.ID? = 9
        let pin = FeedPlace.pin(
            Binding(get: { standing }, set: { standing = $0 }),
            isFollowing: true,
            whileResizing: false,
        )

        #expect(pin.wrappedValue == nil)
        #expect(standing == 9)
    }

    /// Reported only once the reader has detached — and the row it reports is the one they detached
    /// on, not one it has to be told about afterwards.
    @Test
    func `a detached reading reports the row it is standing on`() {
        var standing: FeedRow.ID? = 9
        let pin = FeedPlace.pin(
            Binding(get: { standing }, set: { standing = $0 }),
            isFollowing: false,
            whileResizing: false,
        )

        #expect(pin.wrappedValue == 9)
    }

    /// The read stays live while a seam moves — the held row goes on being pinned — and only the
    /// WRITE is refused. A pin that went blank mid-drag would drop the reader's place entirely.
    @Test
    func `a moving seam keeps reporting the held row and refuses the write`() {
        var standing: FeedRow.ID? = 9
        let pin = FeedPlace.pin(
            Binding(get: { standing }, set: { standing = $0 }),
            isFollowing: false,
            whileResizing: true,
        )

        pin.wrappedValue = 14

        #expect(standing == 9)
        #expect(pin.wrappedValue == 9)
    }

    /// And the scroller's election lands the moment the column is still again — the refusal is for
    /// the length of the drag, not a latch that outlives it.
    @Test
    func `a still column takes the election through the binding`() {
        var standing: FeedRow.ID? = 9
        let pin = FeedPlace.pin(
            Binding(get: { standing }, set: { standing = $0 }),
            isFollowing: false,
            whileResizing: false,
        )

        pin.wrappedValue = 14

        #expect(standing == 14)
    }
}
