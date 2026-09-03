import AppKit
@testable import ArgoUI

/// A real deck's worth of the two things the shell holds across a reading switch — the scroll
/// authority and the height stores — with a real coordinator under them.
///
/// Nothing here stands in for anything: the table, its scroll view and its rulers are the ones the
/// deck builds, because a fake height store would agree with whatever the suite expected.
@MainActor struct FeedSwitchDeck {
    let coordinator: FeedTableCoordinator
    /// Held STRONGLY, because the coordinator's own reference down to it is weak — SwiftUI owns
    /// the view in the running app. A suite that let it go would lay nothing out and measure
    /// nothing, with every claim about a cost passing.
    let scroller: NSScrollView?
    let geometries = FeedGeometries()
    let handle = FeedTableHandle()

    /// The pane a deck column is about this wide, and short enough that most of a reading is off
    /// screen — which is where a re-measure's tail lives.
    static let pane = CGSize(width: 460, height: 300)

    /// Opened on nothing, so the first `show` is itself a switch off the unattached reading — what
    /// a deck mounting onto an already-selected Session does.
    init() async {
        self.coordinator = await FeedTableFixture.laidOut(
            [], in: Self.pane,
            keeping: FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: FeedGeometry()),
        )
        self.scroller = coordinator.scroller
        coordinator.handle = handle
        handle.coordinator = coordinator
    }

    func show(_ rows: [FeedRow], of reading: FeedReading) async {
        await FeedTableFixture.show(rows, of: reading, on: coordinator, keeping: geometries)
    }

    /// A switch as the SHELL takes it: the new reading with an empty feed on the pass that paints
    /// the click, and its rows a turn later (`DrawnSession`). Two `show`s, because a claim about a
    /// switch made in one of them is a claim about a pass the app no longer has.
    func switching(to rows: [FeedRow], of reading: FeedReading) async {
        await show([], of: reading)
        await show(rows, of: reading)
    }
}

/// The two readings a switch moves between, and the rows that make them.
enum FeedSwitchFixture {
    static let alpha = FeedReading(session: "alpha")
    static let bravo = FeedReading(session: "bravo")

    /// Long enough that the pane above holds a fraction of it, so every claim about the whole
    /// reading is a claim about rows nobody can see.
    static let alphaRows = rows("Alpha", count: 120)
    static let bravoRows = rows("Bravo", count: 90)

    static func rows(_ name: String, count: Int) -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(id: $0, content: .message("\(name) line \($0), long enough to wrap the pane."))
        }
    }
}
