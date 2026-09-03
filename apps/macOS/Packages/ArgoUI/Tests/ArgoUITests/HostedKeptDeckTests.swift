import AppKit
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The reader leaving a Session and coming back to it, through the WHOLE shell — the click written
/// into the navigation the Roster writes, and the deck read off the view tree `CockpitView` built.
///
/// The store's own suites hold the decks to their claims one at a time, and every one of them could
/// pass while the shell on screen went on building a table per click. This is the claim that spans
/// the path: the deck the reader comes back to is the deck they left, at the offset they left it
/// at, with nothing measured for the return (ADR-0030, Rule 4).
@Suite("Kept decks, hosted", .serialized)
@MainActor
struct HostedKeptDeckTests {
    private static let first = "one"
    private static let other = "two"

    /// A → B → A. The same `NSTableView`, the same offset, and not one row measured again.
    @Test
    func `coming back to a Session shows the deck it was left at`() async throws {
        let shell = HostedCockpit(showing: Self.roster)
        try await shell.drawn()
        let alpha = try #require(shell.deck())
        // The reader scrolls back up through the reading, which is the state a click leaves.
        alpha.settle(at: 0, over: nil)
        let offset = try #require(alpha.offset())
        let measured = alpha.measurements

        shell.select(Self.other)
        try await shell.drawn()
        let bravo = try #require(shell.deck())
        shell.select(Self.first)
        try await shell.drawn()

        // The other Session really was read, or the equalities below are a shell that never
        // switched.
        #expect(bravo !== alpha)
        #expect(shell.deck() === alpha)
        #expect(alpha.measurements == measured)
        #expect(alpha.offset() == offset)
    }

    /// Two Sessions with real transcripts in them, which is what makes a measure worth counting.
    private static var roster: CockpitPresentation {
        HostedCockpit.presentation(
            of: [first, other],
            events: TranscriptFixtures.longTranscript,
        )
    }
}

extension HostedCockpit {
    /// The coordinator of the deck ON SCREEN — the one `FeedDeckStack` is showing, never one of the
    /// kept decks hidden behind it.
    func deck() -> FeedTableCoordinator? {
        HostedDeck.find(FeedTableView.self, in: host)?.delegate as? FeedTableCoordinator
    }

    /// The shell settled far enough for the deck on screen to be DRAWING its reading: the reading
    /// itself is deferred a turn (`DrawnSession`) and the measure behind it is a `Task` on another
    /// thread (ADR-0030, Rule 3), so a claim about what a switch cost has to wait for both.
    ///
    /// Bounded, so a pass that never lands fails a case rather than hanging it.
    func drawn(within turns: Int = 200) async throws {
        for _ in 0 ..< turns {
            await settle()
            if deck()?.geometry.isSettled == true, deck()?.isMeasuring == false {
                return
            }
            try await Task.sleep(for: .milliseconds(2))
        }
        Issue.record("The hosted shell drew no settled document.")
    }
}
