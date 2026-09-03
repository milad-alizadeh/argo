import AppKit
import ArgoDesign
import SwiftUI

/// The AppKit half of the feed: what the table draws, and the one thing that moves the scroll.
///
/// It decides nothing about WHERE the reading lands — that is `FeedScrollPolicy`'s, reached through
/// the handle. What stays here is AppKit facts only: the scroll view, the table, the
/// measured-height cache, and the keyboard's focused row.
@MainActor final class FeedTableCoordinator: NSObject {
    var model: FeedTableModel?
    /// The shared scroll authority, which holds the policy this coordinator reports to.
    weak var handle: FeedTableHandle?
    /// What the table currently draws — the rows of the settled document that stands, and never
    /// the rows of a model no pass has measured yet. Written in one place, the turn a document
    /// lands (`FeedTableCoordinator+Settling`).
    var shown: [FeedRow] = []
    /// What the visible cells were last drawn against. Not `private`, because the opening half
    /// re-seats all three when another reading arrives — see `FeedTableCoordinator+Opening`.
    var folds: Set<FeedRow.ID> = []
    var drawnOpen: FeedRow.ID?
    /// See `FeedTableModel.washed`.
    var drawnWashed: FeedRow.ID?
    /// Whether the last model arrived mid seam-drag — the edge off it is when the full re-measure
    /// runs.
    private var wasResizing = false

    weak var table: FeedTableView?
    weak var scroller: NSScrollView?

    /// The row the keyboard is on. The table's own fact, not `FocusState`'s — the rows live in
    /// separate hosting hierarchies now, and a focus value none of them can resolve is noise.
    ///
    /// Written by an arrow key and by the deck handing the keyboard back, and by no click path.
    var focusedRow: Int? {
        didSet { redrawCursor(oldValue, focusedRow) }
    }

    /// Whether the reading is where the keyboard is AND the keyboard is what the reader is
    /// working with. Both halves are needed, and the second is the one #533 is about: a click into
    /// the reading makes the table first responder too, so a ring drawn on the first half alone
    /// comes back under the pointer, on whichever row the reader last arrowed to.
    private(set) var hasKeyboard = false {
        didSet { redrawCursor(focusedRow) }
    }

    /// The whole-document measure pass in flight — see `FeedTableCoordinator+Settling`.
    var settling: Task<Void, Never>?
    /// The quiet a width burst is waited out in, before the pass that answers its last frame —
    /// see `settleWhenQuiet()`. One wait, and both places a burst is seen arm this one.
    var quieting: Task<Void, Never>?

    /// Whether a settle decision is on the stack — see `settleIfOwed()`.
    var isDecidingSettle = false

    /// The opening scroll, decided and not yet landed — see `place()`.
    var placing: FeedScrollDecision?

    /// Whether the deck owes the reader a measure — a pass in flight, or a width burst whose pass
    /// is armed and has not started. The one question every surface over the geometry asks besides
    /// "is there a document", and the two together are what `isProvisional` means to the lane.
    var isMeasuring: Bool {
        settlingFor != nil || quieting != nil
    }

    /// The quiet-wait finished or was retired. Cleared HERE and not where it is armed, because a
    /// `Task` property is assigned once and never cleared, so a finished wait looks exactly like a
    /// running one.
    func finishedQuiet() {
        quieting = nil
    }

    /// The measure run out — every pass in flight, and every pass a burst has armed but not
    /// started. What says the deck is showing geometry rather than standing in for it.
    ///
    /// Bounded, so a pass that never comes back fails a case rather than hanging it: a landing may
    /// start another, and a width burst arms one per frame.
    func measured(over passes: Int = 12) async {
        for _ in 0 ..< passes where isMeasuring {
            await quieting?.value
            await settling?.value
        }
    }

    /// The stamp that pass is FOR. A `Task` property is assigned once and never cleared, so a
    /// finished pass looks exactly like a running one; this says which reading, at which width,
    /// the answer on its way is a document of, and a landing that no longer matches is dropped.
    var settlingFor: FeedMeasureStamp?

    /// The settled document this table opens on — the store behind `heightOfRow`.
    ///
    /// Manual heights rather than `usesAutomaticRowHeights`, and that is the scroll's frame
    /// budget: automatic heights answer through the constraint engine, where an `NSHostingView`
    /// runs THREE full SwiftUI layout passes per row scrolled in (its min, ideal and max size
    /// constraints). Profiled, not surmised — the stutter was that tower. A delegate height here
    /// is an array read: the measuring happened before the table drew anything (ADR-0030).
    ///
    /// A reference, and OUTLIVING this coordinator wherever the shell hands one in: the deck is
    /// destroyed and rebuilt on a room switch, and a document held here alone was measured again
    /// every time the reader came back to a reading nothing had changed about (#858). Its own by
    /// default, so a preview, a specimen and a suite each measure into one of their own.
    private(set) var geometry = FeedGeometry()

    /// How many cells the table has been handed, ever. A cell is one SwiftUI tree built or diffed,
    /// which is the interactive cost a scroll and a mount both pay — and unlike `measurements` it
    /// is not saved by the height cache. What ADR-0028 Rule 1 is asked with, for the mount.
    var exposures = 0

    /// How many rows have actually been measured, ever. Not a statistic: it is what #856's claim is
    /// about, and the only honest way for a suite to ask what a pass COST rather than what it left
    /// behind. Counted where the pass lands, because that is the one place measuring happens now.
    private(set) var measurements = 0

    /// The pane size the reading was last laid out against. Written when a derivation RUNS rather
    /// than when a notification arrives, so it can only ever name a size that was laid out.
    private(set) var laidOutPane: CGSize?

    /// Whether a pane derivation is on the stack. Landing the reading forces a layout, and that
    /// layout can resize the clip view — posting the notification that forced it.
    private(set) var isDerivingPane = false

    /// How many sizes one notification is followed through before the pane is left to the settle
    /// timer. Three, because a mount converges in two and a runaway must not be a hang.
    nonisolated static let panePasses = 3

    #if DEBUG
        /// See `FeedPaneCost`.
        private(set) var paneCost = FeedPaneCost()
    #endif

    /// The rows one pass paid for. Here rather than beside the pass because a `private(set)` is
    /// writable in this file alone.
    func noted(_ rows: Int) {
        measurements += rows
    }

    /// One frame notification arrived — see `FeedPaneCost`.
    func notedPane() {
        #if DEBUG
            paneCost.notices += 1
            paneCost.reentrances += isDerivingPane ? 1 : 0
        #endif
    }

    /// Whether the reading already stands laid out against this pane. A handler decides; it does
    /// not compute (ADR-0028 Rule 2), and this is the whole decision.
    func hasLaidOut(_ pane: CGSize) -> Bool {
        pane == laidOutPane
    }

    /// One pane derivation, against the size it is derived for. The size is recorded only where
    /// the reading was actually laid out against it: a pass no policy answered laid out nothing.
    func derivingPane(at pane: CGSize, _ work: () -> Bool) {
        #if DEBUG
            paneCost.nestings += isDerivingPane ? 1 : 0
        #endif
        isDerivingPane = true
        defer { isDerivingPane = false }
        guard work() else { return }
        #if DEBUG
            paneCost.derivations += 1
        #endif
        laidOutPane = pane
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// A fresh reading, reported to the policy as the difference from the shown one.
    ///
    /// A model in which nothing DRAWN changed is applied and left alone. `updateNSView` runs on
    /// every invalidation of the view above — every frame of a seam drag included — and a refresh
    /// on each of those re-rendered every visible cell at drag rate, which was the jitter the
    /// seam had and the window's own resize did not.
    func apply(_ fresh: FeedTableModel) {
        // Before anything is resolved against it: a table that replaced another under this handle
        // is a fresh reading, and the policy answering it is the last one's.
        handle?.reopenIfOwed(held: fresh.held)
        let staleEnvironment = model?.environment
        // Asked of the model that stands, before it is replaced. `model != nil` and not the reading
        // alone: the FIRST apply is a mount, not a switch.
        let switched = model != nil && model?.reading != fresh.reading
        model = fresh
        guard table != nil else { return }
        if switched {
            openAfresh()
        } else {
            touchUp(against: fresh, from: staleEnvironment)
        }
        // The rows themselves are NOT taken here. What the table draws changes in one place only —
        // the turn a settled document lands on (`FeedTableCoordinator+Settling`) — because the
        // rows and the heights they are drawn at have to change together or the feed spends a
        // frame drawing one reading at another's geometry, which is every defect ADR-0030 names.
        //
        // The seam letting go is the moment the width is final: the pass a live drag deferred runs
        // then, against a width that is a fact rather than a frame of a drag.
        if wasResizing, !fresh.isResizing {
            settleAfterResize()
        }
        wasResizing = fresh.isResizing
        // The gutter under the last row is part of the content — grown under a composer so the
        // newest line genuinely ends clear of the vessel, and every follow lands below it.
        scroller?.contentInsets.bottom = fresh.isUnderComposer
            ? ArgoComposerVessel.feedClearance
            : ArgoSpacing.section
        // The gutter above it grows by whatever the canopy covers. An inset and not a frame: the
        // rows keep the deck's full height to scroll through, and only START below the glass.
        scroller?.contentInsets.top = ArgoSpacing.section + fresh.environment.deckCanopy
        // Never: the overview lane stands beside every reading and its lit rectangle IS this
        // scrollbar, so the platform's own would draw a second one between the reading and its map.
        scroller?.hasVerticalScroller = false
        // And NOT `place()`: the opening scroll is owed to the ROWS, and this pass has none of them
        // until a document lands. Claimed on the turn one does — see `landed(_:for:)`.
        settleIfOwed()
    }

    /// The model as the table DRAWS it: the freshest facts the deck holds — the open row, the
    /// folds, the wash, the ink — over the rows of the settled document that stands.
    ///
    /// The two halves move at different rates and this is where they are put back together. A fold
    /// or a wash changes what a cell draws and nothing about the document, so those are taken from
    /// the model that arrived last. The ROWS are the document's, because a cell built from a row
    /// the table has no height for is a cell drawn at another row's height — and a model that
    /// shrank would be read past its end by an index the table still holds.
    var drawn: FeedTableModel? {
        guard var drawn = model else { return nil }
        drawn.rows = shown
        return drawn
    }

    /// The settled document surrendered, because it is a document of a reading that is no longer
    /// being shown. Its absence is what puts the deck in its provisional state.
    func surrenderDocument() {
        // Nothing to surrender is nothing to do, and saying so is not tidiness: a reload moves the
        // table's frame, which is where a settle is decided from (`reshaped()`) — so a surrender
        // that reloaded an already-empty table would reload it again on the frame change it caused,
        // for as long as the pass it is waiting on takes to land.
        guard geometry.isSettled || !shown.isEmpty else { return }
        geometry.surrender()
        shown = []
        handle?.settled(false)
        table?.reloadData()
    }

    /// Where the reading's measured heights are kept, when the shell keeps them somewhere that
    /// survives this coordinator. Taken before anything is measured — `FeedTable.bind(_:through:)`
    /// runs ahead of the first `apply` — so nothing already known is ever thrown away by the swap.
    /// `nil` where nothing above holds any — a preview, a specimen — which leaves this one its own.
    func keep(_ geometry: FeedGeometry?) {
        guard let geometry, geometry !== self.geometry else { return }
        self.geometry = geometry
    }

    /// Re-draws the named rows. Cells exist only for realised rows, so this is what a row whose
    /// drawn facts moved without its height moving costs — a cursor, a wash, a panel closing.
    ///
    /// It never re-measures. A height comes off the settled document and changes when a fresh one
    /// lands, which is the whole of ADR-0030 Rule 5.
    func refresh(rows: IndexSet) {
        guard let table, let drawn else { return }
        let drawable = rows.filteredIndexSet(includeInteger: { shown.indices.contains($0) })
        for row in drawable {
            let cell = table.view(atColumn: 0, row: row, makeIfNecessary: false) as? FeedRowCell
            cell?.host.rootView = drawn.content(at: row, hasCursor: row == cursorRow)
        }
    }

    /// The keyboard arriving at the reading or leaving it — see `FeedTableView.keyboardMoved`.
    func noteKeyboard(_ isHere: Bool) {
        hasKeyboard = isHere
    }

    func visibleRows() -> IndexSet {
        guard let table else { return [] }
        let visible = table.rows(in: table.visibleRect)
        return IndexSet(integersIn: visible.location ..< visible.location + visible.length)
    }

    /// The equal-rows path: nothing structural moved, so only what a cell DRAWS can be stale —
    /// and only the rows whose rendered fact changed are touched, because replacing a rootView
    /// resets whatever in-row state the reader had (a text selection, a hover).
    private func touchUp(
        against fresh: FeedTableModel,
        from staleEnvironment: FeedCellEnvironment?,
    ) {
        // A theme or type-size flip re-inks everything. The heights it retires are the settling
        // half's — a fresh ink is a fresh stamp, which is a re-wrap.
        if fresh.environment.reInks(against: staleEnvironment) {
            refresh(rows: visibleRows())
        }
        var affected = IndexSet()
        if fresh.selection.open != drawnOpen {
            // A row's id IS its position — assigned as one by `FeedProjection.rows`.
            affected.formUnion(IndexSet([drawnOpen, fresh.selection.open].compactMap(\.self)))
        }
        let unfolded = fresh.unfolded.wrappedValue
        if unfolded != folds {
            affected.formUnion(IndexSet(folds.symmetricDifference(unfolded)))
        }
        if fresh.washed != drawnWashed {
            affected.formUnion(IndexSet([drawnWashed, fresh.washed].compactMap(\.self)))
        }
        folds = unfolded
        drawnWashed = fresh.washed
        drawnOpen = fresh.selection.open
        guard !affected.isEmpty else { return }
        refresh(rows: affected)
    }
}
