import AppKit
@testable import ArgoUI
import Foundation
import Testing

/// One deck per kept Session, capped, least recently used evicted — and the heights kept past the
/// eviction (ADR-0030, Rule 4).
///
/// The cap is a hidden `UserDefaults` default rather than a preference screen, so the suite reads
/// it the way the app does: through `KeptDecks.cap(from:)`, off a suite's own defaults rather than
/// off the reader's.
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

    /// A cap of nothing is not a smaller cache but a window that can hold no deck at all, so a
    /// number that would mean that is read as the smallest one that means anything.
    @Test
    func `a cap of nothing still keeps the deck on screen`() throws {
        let defaults = try Self.defaults()
        defaults.set(0, forKey: KeptDecks.capDefault)
        #expect(KeptDecks.cap(from: defaults) == KeptDecks.defaultCap)

        let decks = KeptDecks(cap: -3)
        let deck = decks.show(Self.reading(0))

        #expect(decks.count == 1)
        #expect(decks.kept(Self.reading(0)) === deck)
    }

    /// The same reading is the same deck, however many times it is shown.
    @Test
    func `a reading shown twice is one deck`() {
        let decks = KeptDecks()

        let first = decks.show(Self.reading(0))
        let again = decks.show(Self.reading(0))

        #expect(first === again)
        #expect(decks.count == 1)
    }

    /// The seventh Session opened pushes out the one the reader has been away from longest — never
    /// the one they are reading, and never the one they came back to on the way.
    @Test
    func `a seventh Session evicts the one left longest ago`() {
        let decks = KeptDecks()
        let kept = (0 ..< KeptDecks.defaultCap).map { decks.show(Self.reading($0)) }
        // Back to the first, which makes the SECOND the one left longest ago.
        _ = decks.show(Self.reading(0))

        _ = decks.show(Self.reading(KeptDecks.defaultCap))

        #expect(decks.count == KeptDecks.defaultCap)
        #expect(decks.kept(Self.reading(1)) == nil)
        #expect(decks.kept(Self.reading(0)) === kept[0])
        #expect(decks.readings.last == Self.reading(KeptDecks.defaultCap))
    }

    /// An evicted deck really is let go: its scroller leaves the view that was showing it, and the
    /// reading behind it stops being anything the window holds.
    @Test
    func `an evicted deck lets its table go`() {
        let decks = KeptDecks(cap: 1)
        let stack = FeedDeckStack()
        let first = decks.show(Self.reading(0))
        stack.show(first, of: decks.decks)

        let second = decks.show(Self.reading(1))
        stack.show(second, of: decks.decks)

        #expect(first.scroller.superview == nil)
        #expect(stack.subviews == [second.scroller])
    }

    /// The stack draws ONE deck. Every other kept one is hidden rather than torn down, which is
    /// what makes coming back a show rather than a reload.
    @Test
    func `the stack shows one deck and hides the rest`() {
        let decks = KeptDecks()
        let stack = FeedDeckStack()
        stack.frame = NSRect(x: 0, y: 0, width: 400, height: 300)
        let first = decks.show(Self.reading(0))
        stack.show(first, of: decks.decks)

        let second = decks.show(Self.reading(1))
        stack.show(second, of: decks.decks)

        #expect(first.scroller.superview === stack)
        #expect(first.scroller.isHidden)
        #expect(!second.scroller.isHidden)
        #expect(second.scroller.frame == stack.bounds)
    }

    /// A hidden deck keeps the frame it was left at. A window resized while the reader is elsewhere
    /// costs it nothing until it is shown again, where the one re-wrap it owes is taken.
    @Test
    func `a hidden deck does not follow the stack's size`() {
        let decks = KeptDecks()
        let stack = FeedDeckStack()
        stack.frame = NSRect(x: 0, y: 0, width: 400, height: 300)
        let first = decks.show(Self.reading(0))
        stack.show(first, of: decks.decks)
        let laid = first.scroller.frame

        stack.show(decks.show(Self.reading(1)), of: decks.decks)
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
