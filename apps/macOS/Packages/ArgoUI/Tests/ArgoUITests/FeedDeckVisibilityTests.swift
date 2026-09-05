import AppKit
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What `FeedDeckStack` is allowed to say to AppKit, and WHEN.
///
/// `show(_:)` runs inside `updateNSView`, which is inside SwiftUI's own update of the view graph.
/// Hiding a view that holds the window's first responder makes AppKit walk the key view loop, which
/// asks every `NSHostingView` under it for its responder node — and that re-enters the very graph
/// the pass is an update of. SwiftUI reports the re-entry as an AttributeGraph cycle and AppKit as
/// a
/// skipped layout pass, and a skipped pass can leave a row at the wrong height with nothing in the
/// pixels to say why (#1260). See `FeedDeckStack.reveal` for what was measured.
///
/// So the claim throughout is about the HIDE and its timing: the pass that switches draws one deck
/// and hides none, and the hide arrives a turn later.
@Suite("Deck visibility", .serialized)
@MainActor
struct FeedDeckVisibilityTests {
    private static let first = "one"
    private static let other = "two"

    /// The pass every re-render is. A running Session re-renders on every line it streams, and none
    /// of those move which deck is forward, so none of them says anything to AppKit.
    ///
    /// Driven at the stack rather than through the shell, because the shell cannot be made to run a
    /// pass that changes nothing — re-selecting the Session already selected invalidates no body,
    /// so
    /// a hosted version of this would assert that nothing was written by a pass that never ran.
    @Test
    func `a pass that switches no deck writes no visibility`() async {
        let decks = KeptDecks(cap: KeptDecks.defaultCap)
        let stack = FeedDeckStack()
        stack.frame = NSRect(x: 0, y: 0, width: 400, height: 300)
        let deck = decks.show(Self.reading)
        stack.show(deck)
        await Task.yield()
        let written = stack.visibilityWrites

        stack.show(deck)
        stack.show(deck)
        await Task.yield()

        #expect(stack.visibilityWrites == written)
        #expect(!deck.scroller.isHidden)
        #expect(deck.scroller.alphaValue == 1)
    }

    /// The pass that switches. Nothing is HIDDEN in it: the deck going away stops drawing and stays
    /// unhidden until the next turn, and the deck coming forward is the one a click would land in.
    @Test
    func `the pass that switches hides nothing`() async throws {
        let shell = HostedCockpit(showing: Self.roster)
        try await shell.drawn()
        let stack = try #require(Self.stack(in: shell))
        let going = try #require(stack.subviews.last)
        let written = stack.visibilityWrites

        shell.select(Self.other)

        #expect(stack.visibilityWrites == written)
        #expect(!going.isHidden)
        #expect(going.alphaValue == 0)
        #expect(stack.subviews.last !== going)
        #expect(stack.subviews.last?.alphaValue == 1)
    }

    /// And a turn later the deck going away is hidden, in one write and no more: the deck coming
    /// forward was built on this pass, and a fresh `NSScrollView` is already unhidden.
    @Test
    func `the turn after the switch hides only the deck that left`() async throws {
        let shell = HostedCockpit(showing: Self.roster)
        try await shell.drawn()
        let stack = try #require(Self.stack(in: shell))
        let written = stack.visibilityWrites

        shell.select(Self.other)
        try await shell.drawn()
        await shell.settle()

        #expect(stack.visibilityWrites == written + 1)
        #expect(stack.subviews.count == 2)
        #expect(stack.subviews.filter { !$0.isHidden }.count == 1)
    }

    /// Coming BACK to a deck the sweep has hidden — the one path where a pass writes `isHidden` at
    /// all. It is an unhide, which walks nothing, and it is still not a hide: the deck being left
    /// is
    /// swept a turn later like any other.
    @Test
    func `coming back to a hidden deck unhides in the pass`() async throws {
        let shell = HostedCockpit(showing: Self.roster)
        try await shell.drawn()
        let stack = try #require(Self.stack(in: shell))
        shell.select(Self.other)
        try await shell.drawn()
        await shell.settle()
        let written = stack.visibilityWrites
        let coming = try #require(stack.subviews.first { $0.isHidden })

        shell.select(Self.first)

        #expect(!coming.isHidden)
        #expect(stack.visibilityWrites == written + 1)
        #expect(stack.subviews.allSatisfy { !$0.isHidden })

        try await shell.drawn()
        await shell.settle()

        #expect(stack.visibilityWrites == written + 2)
        #expect(stack.subviews.filter { !$0.isHidden }.count == 1)
    }

    /// The stack ON SCREEN, found by type: the shell builds it, and a suite that held one instead
    /// would be asserting against a view nothing on screen is.
    private static func stack(in shell: HostedCockpit) -> FeedDeckStack? {
        HostedDeck.find(FeedDeckStack.self, in: shell.host)
    }

    /// One reading, for the case driven at the stack rather than through the shell.
    private static var reading: FeedReading {
        FeedReading(session: first)
    }

    /// Two Sessions with real transcripts in them, so there is a deck to switch to.
    private static var roster: CockpitPresentation {
        HostedCockpit.presentation(
            of: [first, other],
            events: TranscriptFixtures.longTranscript,
        )
    }
}
