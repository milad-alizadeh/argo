import AppKit
@testable import ArgoUI

/// A real deck per reading, kept the way the shell keeps them, with the heights beside them in the
/// store that outlives eviction (ADR-0030, Rule 4).
///
/// Nothing here stands in for anything: the decks are `KeptDecks`' and they are shown through the
/// `FeedDeckStack` the deck zone puts on screen, so a claim about a switch is a claim about the
/// shipped store. A hand-rolled deck per reading would agree with whatever the suite expected.
@MainActor final class FeedSwitchDeck {
    let decks: KeptDecks
    /// The view the decks are shown through — one on screen, the rest hidden behind it.
    let stack = FeedDeckStack()
    /// The heights, held above the decks and bounded far wider — which is what lets an evicted
    /// Session re-open over known geometry.
    let geometries = FeedGeometries()

    /// Which reading is on screen. The unattached one until the first `show`, so that first show
    /// is itself a switch — what a deck mounting onto an already-selected Session does.
    private(set) var reading = FeedReading.unattached

    /// The pane a deck column is about this wide, and short enough that most of a reading is off
    /// screen — which is where a re-measure's tail lives.
    static let pane = CGSize(width: 460, height: 300)

    init(cap: Int? = nil) {
        self.decks = KeptDecks(cap: cap)
        stack.frame = NSRect(origin: .zero, size: Self.pane)
    }

    /// The deck on screen, and the three things every case here asks it.
    var deck: KeptDeck {
        decks.show(reading)
    }

    var coordinator: FeedTableCoordinator {
        deck.coordinator
    }

    var handle: FeedTableHandle {
        deck.handle
    }

    var scroller: NSScrollView {
        deck.scroller
    }

    /// Another reading shown: its own deck, made on first sight and found again on the way back.
    ///
    /// `async` because the measure is: the whole document is measured off the main actor before a
    /// row of it is drawn (ADR-0030, Rule 3), and the opening scroll lands over the next few turns
    /// of the run loop.
    func show(_ rows: [FeedRow], of reading: FeedReading) async {
        let deck = click(rows, of: reading)
        deck.scroller.layoutSubtreeIfNeeded()
        await FeedTableFixture.settled(deck.coordinator)
        for _ in 0 ... FeedTableCoordinator.panePasses {
            try? await Task.sleep(for: .milliseconds(1))
        }
    }

    /// One click, with no time to settle before the next — a reader clicking two roster rows inside
    /// the same beat. The measure it starts is left in flight deliberately.
    @discardableResult func click(_ rows: [FeedRow], of reading: FeedReading) -> KeptDeck {
        self.reading = reading
        // Asked BEFORE the deck is opened: only a deck being built needs the fixture to stand in
        // for a window, and one already drawing a document has a table sized to that document.
        let isFresh = decks.kept(reading) == nil
        let deck = decks.show(reading)
        stack.show(deck)
        if isFresh {
            lay(deck)
        }
        deck.coordinator.keep(geometries.geometry(for: reading))
        // The deck's own folds, as the shipped binding hands them down (`FeedView.folds`).
        deck.coordinator.apply(
            FeedTableFixture.model(showing: rows, unfolded: deck.folds ?? []),
        )
        return deck
    }

    /// Every kept deck's measure run out, however many a burst of clicks started.
    func settleEvery() async {
        for deck in decks.decks {
            await FeedTableFixture.settled(deck.coordinator)
        }
    }

    /// A switch as the SHELL takes it: the new reading with an empty feed on the pass that paints
    /// the click, and its rows a turn later (`DrawnSession`). Two `show`s, because a claim about a
    /// switch made in one of them is a claim about a pass the app no longer has.
    func switching(to rows: [FeedRow], of reading: FeedReading) async {
        await show([], of: reading)
        await show(rows, of: reading)
    }

    /// The deck kept for a reading, or `nil` where it was evicted — asked WITHOUT bringing it back,
    /// which is the whole of what an eviction claim needs.
    func kept(_ reading: FeedReading) -> KeptDeck? {
        decks.kept(reading)
    }

    /// A fresh deck's table sized to the scroller the stack has just framed. A scroll view in no
    /// window lays its document view out for nobody, so the suite does what a window would — once,
    /// because every size after this one is the document's own.
    private func lay(_ deck: KeptDeck) {
        deck.coordinator.table?.frame = deck.scroller.frame
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
