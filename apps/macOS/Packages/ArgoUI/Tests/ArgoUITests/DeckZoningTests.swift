import ArgoDesign
import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import SwiftUI
import Testing

/// Which zones exist on the deck and how wide they open. `ArgoLayout` keeps the tokens; these are
/// the decisions made from them, checked against a real deck width.
@Suite("Deck zoning")
struct DeckZoningTests {
    /// The narrowest deck the window can produce: the sidebar at its minimum still leaves this.
    private let deck = ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth

    // MARK: - The rail

    @Test
    func `the rail is on screen while a subagent is running`() {
        #expect(zoning(feed: working).showsRail)
    }

    @Test
    func `a Session that delegated nothing gets no rail`() {
        #expect(!zoning(feed: quiet).showsRail)
    }

    /// Never beside the panel: the two would leave the feed less than its floor, and the panel is
    /// what the reader just asked for.
    @Test
    func `the rail is shut while the evidence panel is open`() {
        #expect(!zoning(feed: working, open: openableRow(in: working)).showsRail)
    }

    /// The case no test named before: `railLimits` clamps to `floor ... max(floor, ceiling)`, so a
    /// deck too narrow for the rail's own floor would otherwise build an inverted range — which
    /// traps at runtime the moment a seam is dragged.
    @Test(arguments: [0 as CGFloat, 1, 320, 480])
    func `a deck too narrow for the rail still yields a range that is not inverted`(
        width: CGFloat,
    ) {
        let limits = zoning(deck: width, feed: working).railLimits

        #expect(limits.lowerBound <= limits.upperBound)
    }

    /// The floor is the rail's own, whatever the deck does: a rail drawn narrower than this is not
    /// a rail.
    @Test
    func `a deck too narrow for the rail pins it to its own floor`() {
        let limits = zoning(deck: 320, feed: working).railLimits

        #expect(limits == ArgoLayout.railWidths.lowerBound ... ArgoLayout.railWidths.lowerBound)
    }

    /// At a real deck the ceiling is what leaves the minimap and the feed their own widths.
    @Test
    func `the rail may not be dragged into the minimap or the feed's floor`() {
        let limits = zoning(feed: working).railLimits
        // The lane at its narrowest: it is a share of what the rail leaves, so it gives way too.
        let taken = ArgoLayout.minimapLaneWidths.lowerBound + ArgoLayout.feedMinimumWidth

        #expect(limits.upperBound <= deck - taken)
        #expect(limits.upperBound <= ArgoLayout.railWidths.upperBound)
    }

    // MARK: - The evidence panel

    @Test
    func `the panel is open exactly while the open row carries evidence`() {
        #expect(zoning(feed: working, open: openableRow(in: working)).isPanelOpen)
        #expect(!zoning(feed: working).isPanelOpen)
    }

    /// A live transcript grows under an open panel, so the id is resolved against the CURRENT feed
    /// — an id no row answers to closes the panel rather than holding it open on nothing.
    @Test
    func `an open row the feed no longer holds closes the panel`() {
        #expect(!zoning(feed: working, open: 9999).isPanelOpen)
    }

    /// The opening width lives nowhere else. Half of the WHOLE deck, because the rail and the
    /// minimap are both shut while the panel is up.
    @Test
    func `a panel nobody has dragged opens at its share of the whole deck`() {
        let opened = zoning(feed: working, open: openableRow(in: working))

        #expect(opened.panelWidth.wrappedValue == (deck * ArgoLayout.evidencePanelShare).rounded())
    }

    @Test
    func `a panel the reader dragged keeps the width they chose`() {
        let opened = zoning(feed: working, open: openableRow(in: working), panel: 340)

        #expect(opened.panelWidth.wrappedValue == 340)
    }

    /// Whatever the reader drags to, the feed keeps its floor — the invariant `ArgoLayout` carries
    /// and this is where it is enforced against a real width.
    @Test
    func `a panel dragged past the feed's floor is seated back inside its limits`() {
        let opened = zoning(feed: working, open: openableRow(in: working), panel: deck)

        #expect(deck - opened.panelWidth.wrappedValue >= ArgoLayout.feedMinimumWidth)
    }

    /// A column of prose at a width between two points re-typesets every line in it — the shimmer
    /// a reader sees while a seam is held.
    @Test
    func `the panel's width is seated on a whole point`() {
        let opened = zoning(deck: deck + 0.5137, feed: working, open: openableRow(in: working))
        let width = opened.panelWidth.wrappedValue

        #expect(width == width.rounded())
    }

    // MARK: - Fixtures

    private func zoning(
        deck: CGFloat? = nil,
        feed: [FeedRow],
        open: FeedRow.ID? = nil,
        panel: CGFloat? = nil,
    )
        -> DeckZoning {
        DeckZoning(
            deck: deck ?? self.deck,
            feed: feed,
            agents: FeedAgents.all(in: feed, of: .running),
            open: open,
            seams: DeckSeams(
                rail: .constant(ArgoAgentsRail.width),
                panel: .constant(panel),
            ),
        )
    }

    /// The first row the panel can actually open on — asked of the feed rather than hardcoded,
    /// because the projection decides which row that is.
    private func openableRow(in feed: [FeedRow]) -> FeedRow.ID? {
        feed.first(where: \.kind.opensEvidence)?.id
    }

    /// A handover the record has not answered, which is a subagent still running, plus a call
    /// carrying something for the panel.
    private let working = FeedProjection.rows(from: [
        .toolCall(FeedFixture.call("hand", tool: "Task", kind: .delegate, naming: "review")),
        .toolCall(FeedFixture.call("look", tool: "Read", kind: .read, naming: "a.swift")),
        .toolCallOutcome(TranscriptFixtures.printed("look", "ok")),
    ])

    /// The same reading with nothing delegated.
    private let quiet = FeedProjection.rows(from: [
        .message(markdown: "Nothing handed over."),
    ])
}
