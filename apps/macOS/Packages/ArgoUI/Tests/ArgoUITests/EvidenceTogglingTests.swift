import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The two behaviours #875 finding 5 left undefined, pinned: what the toolbar's toggle opens on
/// when the reader has picked no row, and what it does when there is nothing to open at all.
@Suite("Evidence toggling")
struct EvidenceTogglingTests {
    @Test
    func `with no row picked it opens on the newest evidence in the reading`() {
        let toggling = EvidenceToggling(feed: twoCalls, open: nil)

        #expect(!toggling.isOpen)
        #expect(toggling.canToggle)
        #expect(toggling.next == openableRows(in: twoCalls).last)
    }

    /// The NEWEST, not the first: a reader who has picked nothing is at the end of the feed.
    @Test
    func `the newest is not the first`() {
        let openable = openableRows(in: twoCalls)

        #expect(openable.count == 2)
        #expect(EvidenceToggling(feed: twoCalls, open: nil).next != openable.first)
    }

    @Test
    func `a press with the panel open closes it`() {
        let toggling = EvidenceToggling(feed: twoCalls, open: openableRows(in: twoCalls).first)

        #expect(toggling.isOpen)
        #expect(toggling.next == nil)
    }

    /// Inert rather than pressable onto an empty column — a reading with nothing to show has
    /// nothing for the panel, and the control says so instead of opening on nothing.
    @Test
    func `a reading with no evidence leaves the control inert`() {
        let toggling = EvidenceToggling(feed: saidNothing, open: nil)

        #expect(!toggling.canToggle)
        #expect(toggling.next == nil)
    }

    /// The control and the deck have to agree, and `DeckZoning.isPanelOpen` resolves the id
    /// against the rows rather than trusting it. An id no row answers to draws no panel — read as
    /// open here, the toggle would report a column that is not on screen and its one press would
    /// close nothing.
    @Test
    func `an id no row answers to reads as shut, not as an open panel`() {
        let toggling = EvidenceToggling(feed: saidNothing, open: 0)

        #expect(!toggling.isOpen)
        #expect(!toggling.canToggle)
    }

    /// The same id against a reading that DOES carry it: open, and one press closes it. The pair
    /// above and below is the whole claim — the rows decide, never the id on its own.
    @Test
    func `the same id against a reading that carries it is open`() throws {
        let open = try #require(openableRows(in: twoCalls).first)
        let toggling = EvidenceToggling(feed: twoCalls, open: open)

        #expect(toggling.isOpen)
        #expect(toggling.next == nil)
    }

    // MARK: - Fixtures

    private func openableRows(in feed: [FeedRow]) -> [FeedRow.ID] {
        feed.filter { $0.content.opened != nil }.map(\.id)
    }

    /// Two calls the projection keeps APART: a run of looking folds into one row (D26), and this
    /// suite is about which of two rows the toggle picks.
    private let twoCalls = FeedProjection.rows(from: [
        .toolCall(FeedFixture.call("first", tool: "Read", kind: .read, naming: "a.swift")),
        .toolCallOutcome(TranscriptFixtures.printed("first", "one")),
        .toolCall(FeedFixture.call("second", tool: "Bash", kind: .execute, naming: "swift test")),
        .toolCallOutcome(TranscriptFixtures.printed("second", "two")),
    ])

    private let saidNothing = FeedProjection.rows(from: [
        .message(markdown: "Nothing to show."),
    ])
}
