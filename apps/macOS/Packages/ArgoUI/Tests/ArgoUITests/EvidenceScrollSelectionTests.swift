import AppKit
import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// The scroll link running the other way: the panel reports whichever step is at the top of its
/// view, and that step is what the feed's folded list highlights (#1646). The click direction is
/// #1355's and is not re-proved here.
///
/// Each half is asserted where it lives. The panel's report needs a REAL scroll of a real
/// `NSScrollView`, because what it reports is read off SwiftUI's own frames. The stale set is a
/// value, so it is asserted as one.
///
/// The one-step rule — a panel with a single result tells the feed nothing — is the PANEL's, held
/// by `evidence.steps.count > 1` in `EvidencePanel.reportTop`. `FeedDrawnFacts` knows nothing
/// about step counts, so `a panel of one step reports nothing` is where that rule is pinned.
@Suite("Evidence scroll selection")
@MainActor
struct EvidenceScrollSelectionTests {
    private static let column = CGSize(width: 620, height: 800)
    /// How many results the panel under test holds. Every bound below is derived from it, so a
    /// fixture grown by one cannot leave an assertion pinning the old last step.
    private static let steps = 6

    /// A third of the way down the document, which for a panel of six equal steps is inside the
    /// second or the third — so the first step's own top has left the view, which is the whole of
    /// what "another step is at the top now" means.
    ///
    /// Derived and not a number: a step's height in points is Core Text's answer, and a literal
    /// that happened to land inside the FIRST step is how an earlier draft of this suite passed
    /// while asserting nothing.
    private static func pastTheFirstStep(of panel: HostedEvidencePanel) throws -> CGFloat {
        try panel.documentHeight() / 3
    }

    /// Before a reader has touched it, the step at the top of the view IS the first one — which is
    /// why opening a folded row lights its first name rather than nothing.
    @Test
    func `at rest the panel reports its first step`() async {
        let panel = HostedEvidencePanel(steps: Self.steps)
        await panel.settled()

        #expect(panel.reported == 0)
    }

    @Test
    func `a scroll past a step reports the step now at the top`() async throws {
        let panel = HostedEvidencePanel(steps: Self.steps)
        try await panel.scrolled(to: Self.pastTheFirstStep(of: panel))
        let reported = try #require(panel.reported)

        #expect(reported > 0)
    }

    /// The far end pinned exactly, not just as "later": every step here is taller than the view,
    /// so a scroll to the foot leaves the LAST step's top above the visible top and no other
    /// qualifies. An off-by-one in `topStep()` fails this.
    @Test
    func `a scroll to the foot reports the last step`() async throws {
        let panel = HostedEvidencePanel(steps: Self.steps)
        try await panel.scrolled(to: panel.documentHeight())

        #expect(panel.reported == Self.steps - 1)
    }

    /// The report names the step at the TOP of the view, so the further the reader scrolls the
    /// later the step.
    @Test
    func `the reported step follows the scroll down the panel`() async throws {
        let panel = HostedEvidencePanel(steps: Self.steps)
        try await panel.scrolled(to: Self.pastTheFirstStep(of: panel))
        let near = try #require(panel.reported)
        try await panel.scrolled(to: panel.documentHeight())
        let far = try #require(panel.reported)

        #expect(far > near)
    }

    /// A panel of one result has no other step to distinguish, so it tells the feed nothing: the
    /// row's own name is already the whole of what its list says.
    @Test
    func `a panel of one step reports nothing`() async throws {
        let panel = HostedEvidencePanel(steps: 1)
        try await panel.scrolled(to: panel.documentHeight())

        #expect(panel.reported == nil)
    }

    /// The fight #1355 rules out: the panel's own report arrives back as `current`, and answering
    /// it with another `scrollTo` would move the panel under the reader.
    ///
    /// Against where the scroll LANDED rather than against a single reading taken afterwards — a
    /// `scrollTo` answering the report is already baked into the later one.
    @Test
    func `the step the panel reported moves the panel nowhere`() async throws {
        let panel = HostedEvidencePanel(steps: Self.steps)
        let scroll = try await panel.scrolled(to: Self.pastTheFirstStep(of: panel))

        #expect(scroll.landed > 0)
        #expect(scroll.stayed == scroll.landed)
    }

    /// The repaint half, and the defect #1646 was. A cell is re-drawn only where the table is told
    /// which row went stale, so a step that moved on its own has to name the row the panel is open
    /// on — or its list keeps the highlight it was last drawn with.
    @Test
    func `the step the panel reported leaves the row it is open on stale`() throws {
        let open = try #require(FeedProjection.previewSurveyRowID)

        let drawn = FeedDrawnFacts(open: open, step: 0)
        #expect(drawn.stale(against: FeedDrawnFacts(open: open, step: 2)) == IndexSet([open]))
    }

    /// The same step arriving again is the panel's report echoing home through the feed, and it
    /// leaves nothing stale: a repaint per pass would cost every visible cell the in-row state the
    /// reader had.
    @Test
    func `the step it is already drawn at leaves nothing stale`() throws {
        let open = try #require(FeedProjection.previewSurveyRowID)

        let drawn = FeedDrawnFacts(open: open, step: 2)
        #expect(drawn.stale(against: FeedDrawnFacts(open: open, step: 2)).isEmpty)
    }

    /// The other half of the repaint: the row the stale set names is a row the table DRAWS, so
    /// `refresh(rows:)` has a cell to hand a fresh tree to. It asks for none
    /// (`makeIfNecessary: false`) and filters to `shown.indices`, so a set naming a row outside
    /// them would be dropped without a word.
    @Test
    func `the stale row is one the table draws`() async throws {
        let open = try #require(FeedProjection.previewSurveyRowID)
        let feed = try await Self.reading(open: open, at: 0)

        let stale = FeedDrawnFacts(open: open, step: 0)
            .stale(against: FeedDrawnFacts(open: open, step: 2))
        #expect(!stale.isEmpty)
        #expect(stale.allSatisfy { feed.coordinator.shown.indices.contains($0) })
    }

    /// A selection and never a scroll (#1355): the reader is reading the panel, and the reading
    /// under their eyes stays exactly where they left it.
    @Test
    func `a step that moved scrolls the feed nowhere`() async throws {
        let open = try #require(FeedProjection.previewSurveyRowID)
        let feed = try await Self.reading(open: open, at: 0)
        let scroller = try #require(feed.coordinator.scroller)
        let before = scroller.contentView.bounds.origin.y

        feed.coordinator.apply(FeedTableFixture.model(showing: Self.rows, open: open, step: 4))
        await FeedTableFixture.settled(feed.coordinator)

        #expect(scroller.contentView.bounds.origin.y == before)
    }

    // MARK: - Fixtures

    /// The shipping preview reading, which is where the one folded run of looking comes from.
    private static let rows = FeedProjection.previewRows

    /// A laid-out feed with the panel open on `open` at one of its steps. The handle is handed
    /// back with it because the coordinator holds it WEAKLY, as the deck's does — a fixture that
    /// let it go would be asserting against a table with no scroll authority.
    private struct Reading {
        let coordinator: FeedTableCoordinator
        let handle: FeedTableHandle
    }

    private static func reading(open: FeedRow.ID, at step: Int) async -> Reading {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(rows, in: column, through: handle)
        coordinator.apply(FeedTableFixture.model(showing: rows, open: open, step: step))
        return Reading(coordinator: coordinator, handle: handle)
    }
}
