import AppKit
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What `FeedDeckStack` is allowed to say to AppKit, and WHEN.
///
/// `show(_:)` runs inside `updateNSView`, which is inside SwiftUI's own update of the view graph.
/// AppKit answers hiding a view by walking the window's key view loop, which asks every
/// `NSHostingView` under it for its responder node — and that re-enters the very graph the pass is
/// an update of. SwiftUI reports the re-entry as an AttributeGraph cycle and AppKit as a skipped
/// layout pass, and a skipped pass can leave a row at the wrong height with nothing in the pixels
/// to say why (#1260).
///
/// So there are two claims here, and the second is the fix: a write to a scroller's visibility only
/// ever stands for a CHANGE, and a HIDE never happens in the pass that decided it.
@Suite("Deck visibility", .serialized)
@MainActor
struct FeedDeckVisibilityTests {
    private static let first = "one"
    private static let other = "two"

    /// The pass every re-render is. Nothing about which deck is forward moved, so nothing is said.
    @Test
    func `a pass that switches no deck writes no visibility`() async throws {
        let shell = HostedCockpit(showing: Self.roster)
        try await shell.drawn()
        let stack = try #require(Self.stack(in: shell))
        let written = stack.visibilityWrites

        shell.select(Self.first)
        try await shell.drawn()
        await shell.settle()

        #expect(stack.visibilityWrites == written)
    }

    /// The pass that switches. Nothing is HIDDEN in it — the deck going away is still on screen
    /// when
    /// the pass ends, and covered rather than racing, because the deck coming forward is topmost.
    /// That is the whole of #1260: the hide is what costs the key view walk, and the walk is only
    /// re-entrant while the update is still running.
    @Test
    func `the pass that switches hides nothing`() async throws {
        let shell = HostedCockpit(showing: Self.roster)
        try await shell.drawn()
        let stack = try #require(Self.stack(in: shell))
        let going = try #require(stack.subviews.last)

        shell.select(Self.other)

        #expect(!going.isHidden)
        #expect(stack.subviews.last !== going)
        #expect(stack.subviews.allSatisfy { !$0.isHidden })
    }

    /// And a turn later the deck going away is gone, in one write and no more: the deck coming
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
        #expect(stack.subviews.last?.isHidden == false)
    }

    /// The stack ON SCREEN, found by type: the shell builds it, and a suite that held one instead
    /// would be asserting against a view nothing on screen is.
    private static func stack(in shell: HostedCockpit) -> FeedDeckStack? {
        HostedDeck.find(FeedDeckStack.self, in: shell.host)
    }

    /// Two Sessions with real transcripts in them, so there is a deck to switch to.
    private static var roster: CockpitPresentation {
        HostedCockpit.presentation(
            of: [first, other],
            events: TranscriptFixtures.longTranscript,
        )
    }
}
