import AppKit
@testable import ArgoUI
import Foundation
import Testing

/// One deck per kept Session, capped, least recently used evicted (ADR-0030, Rule 4).
///
/// The cap is a hidden `UserDefaults` default rather than a preference screen, so the suite reads
/// it the way the app does: through `KeptDecks.cap(from:)`, off a suite's own defaults rather than
/// off the reader's. Every store built here is given its cap outright for the same reason — a
/// `KeptDecks()` would take the cap this machine's own defaults happen to say.
@Suite("Kept decks")
@MainActor
struct KeptDecksTests {
    /// The agreed six, with nothing written down.
    @Test
    func `the cap is six where the hidden default says nothing`() throws {
        let defaults = try Self.defaults()

        #expect(KeptDecks.cap(from: defaults) == KeptDecks.defaultCap)
        #expect(KeptDecks.defaultCap == 6)
    }

    /// The whole point of a hidden default: a reader who wants more decks writes the number and
    /// relaunches, and nothing is rebuilt for it.
    @Test
    func `the hidden default moves the cap`() throws {
        let defaults = try Self.defaults()
        defaults.set(11, forKey: KeptDecks.capDefault)

        #expect(KeptDecks.cap(from: defaults) == 11)
    }

    /// A number that would mean no deck at all is read as the agreed six.
    @Test
    func `a hidden default of nothing is no answer at all`() throws {
        let defaults = try Self.defaults()
        defaults.set(0, forKey: KeptDecks.capDefault)

        #expect(KeptDecks.cap(from: defaults) == KeptDecks.defaultCap)
    }

    /// And a store asked for a cap that cannot hold the deck on screen still holds it.
    @Test
    func `a cap of nothing still keeps the deck on screen`() {
        let decks = KeptDecks(cap: -3)

        let deck = decks.show(Self.reading(0))

        #expect(decks.count == 1)
        #expect(decks.kept(Self.reading(0)) === deck)
    }

    /// The wiring the pure function above cannot hold: a store given no cap takes the LAUNCH's,
    /// and one given a cap takes that. A slip either way — the default in place of the launch cap,
    /// or the launch cap in place of what a caller asked for — passes every case above.
    @Test
    func `a store takes the cap it is given, and the launch's where it is given none`() {
        #expect(KeptDecks(cap: 3).cap == 3)
        #expect(KeptDecks().cap == KeptDecks.launchCap)
        #expect(KeptDecks.launchCap == KeptDecks.cap(from: .standard))
    }

    /// The same reading is the same deck, however many times it is shown.
    @Test
    func `a reading shown twice is one deck`() {
        let decks = KeptDecks(cap: KeptDecks.defaultCap)

        let first = decks.show(Self.reading(0))
        let again = decks.show(Self.reading(0))

        #expect(first === again)
        #expect(decks.count == 1)
    }

    /// A deck opens HELD where its own reading is held — the row a still or a specimen names. A
    /// dense position, so it is seeded at the deck rather than carried into one.
    @Test
    func `a deck opens held at its own row`() {
        let decks = KeptDecks(cap: KeptDecks.defaultCap)

        let held = decks.show(Self.reading(0), opening: 250)
        let tail = decks.show(Self.reading(1))

        #expect(!held.handle.isFollowing)
        #expect(tail.handle.isFollowing)
    }

    /// The seventh Session opened pushes out the one the reader has been away from longest — never
    /// the one they are reading, and never the one they came back to on the way.
    @Test
    func `a seventh Session evicts the one left longest ago`() {
        let decks = KeptDecks(cap: KeptDecks.defaultCap)
        let kept = (0 ..< KeptDecks.defaultCap).map { decks.show(Self.reading($0)) }
        // Back to the first, which makes the SECOND the one left longest ago.
        _ = decks.show(Self.reading(0))

        _ = decks.show(Self.reading(KeptDecks.defaultCap))

        #expect(decks.count == KeptDecks.defaultCap)
        #expect(decks.kept(Self.reading(1)) == nil)
        #expect(decks.kept(Self.reading(0)) === kept[0])
        #expect(decks.readings.last == Self.reading(KeptDecks.defaultCap))
    }

    /// An evicted deck really is let go: it is retired at once, and its scroller leaves the view
    /// showing it on that view's next update — never inside the pass that decided the eviction.
    @Test
    func `an evicted deck lets its table go`() {
        let decks = KeptDecks(cap: 1)
        let stack = FeedDeckStack()
        let first = decks.show(Self.reading(0))
        stack.show(first)

        let second = decks.show(Self.reading(1))
        #expect(first.isRetired)
        #expect(first.scroller.superview === stack)
        stack.show(second)

        #expect(first.scroller.superview == nil)
        #expect(stack.subviews == [second.scroller])
    }

    /// The stack draws ONE deck. Every other kept one is hidden rather than torn down, which is
    /// what makes coming back a show rather than a reload.
    @Test
    func `the stack shows one deck and hides the rest`() {
        let decks = KeptDecks(cap: KeptDecks.defaultCap)
        let stack = FeedDeckStack()
        stack.frame = NSRect(x: 0, y: 0, width: 400, height: 300)
        let first = decks.show(Self.reading(0))
        stack.show(first)

        let second = decks.show(Self.reading(1))
        stack.show(second)

        #expect(first.scroller.superview === stack)
        #expect(first.scroller.isHidden)
        #expect(!second.scroller.isHidden)
        #expect(second.scroller.frame == stack.bounds)
    }

    /// A hidden deck keeps the frame it was left at. A window resized while the reader is elsewhere
    /// costs it nothing until it is shown again, where the one re-wrap it owes is taken.
    @Test
    func `a hidden deck does not follow the stack's size`() {
        let decks = KeptDecks(cap: KeptDecks.defaultCap)
        let stack = FeedDeckStack()
        stack.frame = NSRect(x: 0, y: 0, width: 400, height: 300)
        let first = decks.show(Self.reading(0))
        stack.show(first)
        let laid = first.scroller.frame

        stack.show(decks.show(Self.reading(1)))
        stack.frame = NSRect(x: 0, y: 0, width: 700, height: 300)
        stack.layoutSubtreeIfNeeded()

        #expect(first.scroller.frame == laid)
    }

    /// One suite-owned `UserDefaults`, so nothing here reads or writes the reader's own.
    private static func defaults() throws -> UserDefaults {
        let defaults = try #require(
            UserDefaults(suiteName: "argo.kept-decks.\(UUID().uuidString)"),
            "The suite could not make defaults of its own.",
        )
        defaults.removeObject(forKey: KeptDecks.capDefault)
        return defaults
    }

    private static func reading(_ session: Int) -> FeedReading {
        FeedReading(session: "session \(session)")
    }
}
