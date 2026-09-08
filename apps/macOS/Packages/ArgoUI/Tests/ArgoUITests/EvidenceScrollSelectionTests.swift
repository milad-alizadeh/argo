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
/// `NSScrollView`, because what it reports is read off SwiftUI's own frames — a suite that called
/// `onScroll` itself would be asserting its own arithmetic. The repaint needs the feed's table,
/// because the rows live in recycled cells that inherit nothing from the tree above them.
@Suite("Evidence scroll selection")
@MainActor
struct EvidenceScrollSelectionTests {
    private static let column = CGSize(width: 620, height: 800)
    /// Far enough that the first step's own top has left the view, which is the whole of what
    /// "another step is at the top now" means.
    private static let pastTheFirstStep: CGFloat = 400

    @Test
    func `a scroll past a step reports the step now at the top`() async throws {
        let panel = HostedEvidencePanel(steps: 6)
        try await panel.scrolled(to: Self.pastTheFirstStep)
        let reported = try #require(panel.reported)

        #expect(reported > 0)
    }

    /// The report names the step at the TOP of the view, so the further the reader scrolls the
    /// later the step — and it never runs past the last one.
    @Test
    func `the reported step follows the scroll down the panel`() async throws {
        let panel = HostedEvidencePanel(steps: 6)
        try await panel.scrolled(to: Self.pastTheFirstStep)
        let near = try #require(panel.reported)
        try await panel.scrolled(to: panel.documentHeight())
        let far = try #require(panel.reported)

        #expect(far > near)
        #expect(far <= 5)
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
    /// that with another `scrollTo` would send the reader back to whichever step they came from.
    @Test
    func `the step the panel reported does not scroll the panel back`() async throws {
        let panel = HostedEvidencePanel(steps: 6)
        let landed = try await panel.scrolled(to: Self.pastTheFirstStep)
        await panel.settled()
        let stayed = try panel.offset()

        #expect(panel.reported != nil)
        // Not back at the top, which is where a `scrollTo` answering the panel's own report
        // would have put it, and not drifting on the passes after that either.
        #expect(landed > 0)
        #expect(stayed == landed)
    }

    /// The repaint half, and the defect #1646 was. A cell is re-drawn only where the table is told
    /// which row went stale, so a step that moved on its own has to name the row the panel is open
    /// on — or its list keeps the highlight it was last drawn with.
    @Test
    func `the step the panel reported leaves the row it is open on stale`() async throws {
        let open = try #require(FeedProjection.previewSurveyRowID)
        let feed = try await Self.reading(open: open, at: 0)

        let scrolled = FeedTableFixture.model(showing: Self.rows, open: open, step: 2)
        #expect(feed.coordinator.staleRows(under: scrolled) == IndexSet([open]))
    }

    /// The same step arriving again is the panel's report echoing home through the feed, and it
    /// leaves nothing stale: a repaint per pass would cost every visible cell the in-row state the
    /// reader had.
    @Test
    func `the step it is already drawn at leaves nothing stale`() async throws {
        let open = try #require(FeedProjection.previewSurveyRowID)
        let feed = try await Self.reading(open: open, at: 2)

        let echo = FeedTableFixture.model(showing: Self.rows, open: open, step: 2)
        #expect(feed.coordinator.staleRows(under: echo).isEmpty)
    }

    /// A selection and never a scroll (#1355): the reader is reading the panel, and the reading
    /// under their eyes stays exactly where they left it.
    @Test
    func `a step the panel reported leaves the feed where it is`() async throws {
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

    private static func reading(open: FeedRow.ID, at step: Int) async throws -> Reading {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(rows, in: column, through: handle)
        coordinator.apply(FeedTableFixture.model(showing: rows, open: open, step: step))
        return Reading(coordinator: coordinator, handle: handle)
    }
}

/// One `EvidencePanel` hosted for real, wired the way `DeckContentRow` wires it: what the panel
/// reports is written straight back as its `current`, so the two directions can fight if the
/// guards let them.
///
/// The precedent for hosting at all is `HostedDeck` — a claim about the seam between a SwiftUI
/// scroll view and what it reports upward cannot be made from either side alone.
@MainActor final class HostedEvidencePanel {
    /// What the panel told the feed, as `FeedRowSelection.scrolled(to:)` receives it.
    @Observable final class Told {
        var step: Int?
    }

    private let told = Told()
    private let host: NSHostingView<AnyView>
    /// Held for the life of the harness: a hosting view with no window lays out but does not run
    /// as one on screen does.
    let window: NSWindow

    /// The panel at the floor of its own zone, and short enough that a few hundred points of
    /// scroll crosses a step for certain.
    private static let size = CGSize(width: 360, height: 320)

    init(steps: Int) {
        self.host = NSHostingView(rootView: AnyView(
            HostedEvidenceWrapper(told: told, evidence: Self.evidence(steps: steps))
                .frame(width: Self.size.width, height: Self.size.height)
                .argoAppearance(),
        ))
        host.frame = NSRect(origin: .zero, size: Self.size)
        self.window = NSWindow(
            contentRect: host.frame,
            styleMask: [.titled],
            backing: .buffered,
            defer: false,
        )
        window.contentView = host
        host.layoutSubtreeIfNeeded()
    }

    var reported: Int? {
        told.step
    }

    /// The panel's own scroller, which SwiftUI built for its `ScrollView`.
    func scroller() throws -> NSScrollView {
        try #require(
            HostedDeck.find(NSScrollView.self, in: host), "The hosted panel built no scroller.",
        )
    }

    func documentHeight() throws -> CGFloat {
        try scroller().documentView?.frame.height ?? 0
    }

    func offset() throws -> CGFloat {
        try scroller().contentView.bounds.origin.y
    }

    /// The reader's own scroll, as far as `offset` reaches, with where it actually landed handed
    /// back — a scroller clamps, and a claim about where the panel STAYED has to be made against
    /// where it went rather than where it was asked to go.
    @discardableResult
    func scrolled(to offset: CGFloat) async throws -> CGFloat {
        await settled()
        let scroller = try scroller()
        scroller.contentView.scroll(to: NSPoint(x: 0, y: offset))
        scroller.reflectScrolledClipView(scroller.contentView)
        await settled()
        return scroller.contentView.bounds.origin.y
    }

    /// The same wait as `settle()`, taken from an `async` caller: `RunLoop.run(_:before:)` is
    /// unavailable there, so the turns are `Task.sleep` and the run loop is turned either side of
    /// them — which is `HostedDeck`'s split, for `HostedDeck`'s reason.
    func settled() async {
        settle()
        for _ in 0 ..< Self.turns {
            try? await Task.sleep(for: .milliseconds(2))
            host.layoutSubtreeIfNeeded()
        }
        settle()
    }

    /// Turns the run loop, then lays out. SwiftUI applies a state write on a turn of its own, and
    /// the panel's report comes off a preference that a layout pass recomputes — so a caller that
    /// only asked for layout would read the frames from before the scroll.
    func settle() {
        for _ in 0 ..< Self.turns {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.002))
            host.layoutSubtreeIfNeeded()
        }
    }

    private static let turns = 24

    /// A run of results, each tall enough that one scroll crosses one.
    static func evidence(steps: Int) -> FeedEvidence {
        FeedEvidence(
            verb: "Ran",
            symbol: "›",
            label: "Ran \(steps) Commands",
            ending: .succeeded,
            steps: (0 ..< steps).map { index in
                FeedEvidence.Step(
                    id: index,
                    address: .typed("say-\(index)"),
                    language: nil,
                    isExternal: false,
                    result: .output(OutputEvidence(
                        tier: .direct,
                        text: (0 ..< 12).map { "line \(index)-\($0)" }.joined(separator: "\n"),
                    )),
                )
            },
        )
    }
}

/// `DeckContentRow.panel`'s wiring, and only that: `current` in, the report written back onto it.
private struct HostedEvidenceWrapper: View {
    let told: HostedEvidencePanel.Told
    let evidence: FeedEvidence

    /// The deck's `FeedRowSelection.step`, held as the state it is above the panel.
    @State private var current: Int?

    var body: some View {
        EvidencePanel(evidence: evidence, current: current, onScroll: reported)
    }

    private func reported(_ step: Int) {
        told.step = step
        current = step
    }
}
