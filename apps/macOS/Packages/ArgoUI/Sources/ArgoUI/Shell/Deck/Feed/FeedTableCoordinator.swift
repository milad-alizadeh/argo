import AppKit
import SwiftUI

/// The AppKit half of the feed: what the table draws, and the one thing that moves the scroll.
///
/// It decides nothing about WHERE the reading lands — that is `FeedScrollPolicy`'s, reached through
/// the handle. What stays here is AppKit facts only: the scroll view, the table, the
/// measured-height cache, the rulers, and the keyboard's focused row.
@MainActor final class FeedTableCoordinator: NSObject {
    var model: FeedTableModel?
    /// The shared scroll authority, which holds the policy this coordinator reports to.
    weak var handle: FeedTableHandle?
    /// What the table currently draws, diffed against each fresh model — the table is not a
    /// SwiftUI view, so nothing re-renders it on a change.
    private(set) var shown: [FeedRow] = []
    /// What the visible cells were last drawn against. Not `private`, because the opening half
    /// re-seats all three when another reading arrives — see `FeedTableCoordinator+Opening`.
    var folds: Set<FeedRow.ID> = []
    var drawnOpen: FeedRow.ID?
    /// See `FeedTableModel.washed`.
    var drawnWashed: FeedRow.ID?
    /// Whether the last model arrived mid seam-drag — the edge off it is when the full
    /// re-measure runs.
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

    /// The full re-measure waiting for a width burst to go quiet — see `FeedSettle`.
    var settling: Task<Void, Never>?
    /// How many deferred measure passes are IN FLIGHT — the quiet-wait a width burst pushes
    /// back, and the chunked pass behind it. Neither `settling` nor `tailing` can answer that: a
    /// `Task` property is assigned once and never cleared, so a finished pass looks exactly like
    /// a running one. Written by the two passes themselves, in `+Scrolling` and `+Remeasure`.
    ///
    /// Read by the overview lane, the one caller that walks the WHOLE document: while a pass is
    /// in flight every measured height is provisional, and a walk would re-measure the document
    /// at burst rate — the work these passes are sliced up to avoid.
    var deferredPasses = 0
    /// The rows nobody can see, measured a batch at a time behind the visible ones — see
    /// `remeasureEverything`.
    var tailing: Task<Void, Never>?

    /// Measured row heights, by row index — the store behind `heightOfRow`.
    ///
    /// Manual heights rather than `usesAutomaticRowHeights`, and that is the scroll's frame
    /// budget: automatic heights answer through the constraint engine, where an `NSHostingView`
    /// runs THREE full SwiftUI layout passes per row scrolled in (its min, ideal and max size
    /// constraints). Profiled, not surmised — the stutter was that tower. A delegate height is
    /// one `sizeThatFits` against the ruler below, paid once per row per width.
    ///
    /// A reference, and OUTLIVING this coordinator wherever the shell hands one in: the deck is
    /// destroyed and rebuilt on a room switch, and heights held here alone were measured again
    /// every time the reader came back to a reading nothing had changed about (#858). Its own by
    /// default, so a preview, a specimen and a suite each measure into one of their own.
    private(set) var geometry = FeedGeometry()

    /// How many cells the table has been handed, ever. A cell is one SwiftUI tree built or diffed,
    /// which is the interactive cost a scroll and a mount both pay — and unlike `measurements` it
    /// is not saved by the height cache. What ADR-0028 Rule 1 is asked with, for the mount.
    var exposures = 0

    /// How many rows have actually been measured, ever — every entry is one full SwiftUI layout
    /// pass. Not a statistic: it is what #856's claim is about, and the only honest way for a suite
    /// to ask what a re-measure COST rather than what it left behind.
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

    /// The views content is measured in — never installed in a window, and building no sizing
    /// constraints of their own: `sizeThatFits` is asked directly.
    ///
    /// One per `FeedRow.Content.Shape` — see that type, which states what the split costs and
    /// why. Ten controllers is the ceiling, because `Shape` has ten cases: an enum key rather than
    /// a cache, so nothing here needs evicting (ADR-0028 Rule 4).
    /// Read and written only through `FeedTableCoordinator+Rulers`, which is where the reason for
    /// keeping one per shape is stated.
    var rulers: [FeedRow.Content.Shape: NSHostingController<AnyView>] = [:]

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
        let stale = shown
        let staleEnvironment = model?.environment
        // Asked of the model that stands, before it is replaced. `model != nil` and not the reading
        // alone: the FIRST apply is a mount, not a switch, and it takes the append path below into
        // an empty table the way it always has.
        let switched = model != nil && model?.reading != fresh.reading
        model = fresh
        shown = fresh.rows
        surrenderMovedChip()
        // A reading that shrank leaves an entry per lost index that nothing can ever match.
        geometry.dropBeyond(fresh.rows.count)
        guard table != nil else { return }
        if switched {
            openAfresh()
        } else if fresh.rows == stale {
            touchUp(against: fresh, from: staleEnvironment)
        } else {
            // The reading boundary: the rulers still hold the last one's live rows, and this one
            // is about to measure its own through them.
            surrenderRulers()
            decide(.rowsChanged(from: stale, to: fresh.rows))
        }
        // The seam letting go is the moment the width is final: one full re-measure squares
        // every off-screen row that rode the drag on a stale height.
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
        place()
    }

    /// One `sizeThatFits` against the ruler, kept — see `geometry`.
    func measuredHeight(at index: Int, in table: NSTableView) -> CGFloat {
        let width = table.bounds.width
        guard let model, shown.indices.contains(index), width > 0 else {
            return Self.estimatedRowHeight
        }
        // The pass's facts once, then the row's own with the question. A height kept under either
        // is not an answer to this one, which is what lets the store outlive the table that filled
        // it (#858).
        geometry.settle(at: width, in: model.environment)
        let ground = FeedGeometry.Ground(at: index, of: model)
        if let known = geometry.height(at: index, under: ground) {
            return known
        }
        let ruler = ruler(for: model.rows[index].content.shape)
        ruler.rootView = model.content(at: index)
        // Rounded UP to a whole point: a non-integral row height still blurs baselines on
        // current macOS, and up rather than to-nearest so text is never clipped by rounding.
        let height = Self.usableHeight(ceil(ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height))
        geometry.record(height, at: index, under: ground)
        measurements += 1
        return height
    }

    /// Measured heights surrendered — all of them for a re-wrap, or the rows named.
    func dropMeasuredHeights(_ rows: IndexSet? = nil) {
        geometry.drop(rows)
    }

    /// Where the reading's measured heights are kept, when the shell keeps them somewhere that
    /// survives this coordinator. Taken before anything is measured — `FeedTable.bind(_:through:)`
    /// runs ahead of the first `apply` — so nothing already known is ever thrown away by the swap.
    /// The chip the arriving rows moved, and the row it moved off — both measured with a chip they
    /// no longer have, or without one they now do.
    ///
    /// The one height a ground cannot judge: `FeedTableModel.content(at:)` asks
    /// `FeedCopy.chipOffer(of:at:)`, which reads the row's whole Turn, where a ground reads the row
    /// and the row above it. Only the reading's LAST message can gain or lose one — every chip
    /// above it is inside a Turn an arrival cannot reach (`FeedTableDelta.chipRow`) — so this is
    /// two rows on the passes that move it and nothing at all on every other.
    private func surrenderMovedChip() {
        let moved = shown.lastIndex { $0.kind.isMessage }
        guard moved != geometry.chipRow else { return }
        geometry.drop(IndexSet([geometry.chipRow, moved].compactMap(\.self)))
        geometry.chipRow = moved
    }

    /// `nil` where nothing above holds any — a preview, a specimen — which leaves this one its own.
    func keep(_ geometry: FeedGeometry?) {
        guard let geometry, geometry !== self.geometry else { return }
        self.geometry = geometry
    }

    /// Re-draws and, when asked, re-measures the named rows. Cells exist only for realised rows,
    /// but a height note is honest for any row — which is what keeps a rewritten row that is OFF
    /// screen from coming back at its old height.
    func refresh(rows: IndexSet, remeasuring: Bool) {
        guard let table, let model else { return }
        let rows = rows.filteredIndexSet { shown.indices.contains($0) }
        for row in rows {
            let cell = table.view(atColumn: 0, row: row, makeIfNecessary: false) as? FeedRowCell
            cell?.host.rootView = model.content(at: row, hasCursor: row == cursorRow)
        }
        guard remeasuring, !rows.isEmpty else { return }
        dropMeasuredHeights(rows)
        // Zero duration: this is a correction, not motion. Left to the default, every unfolded
        // prompt would ease the rows below it down.
        NSAnimationContext.runAnimationGroup { pass in
            pass.duration = 0
            table.noteHeightOfRows(withIndexesChanged: rows)
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
        // A theme or type-size flip re-inks everything and retires every measured height.
        if fresh.environment.reInks(against: staleEnvironment) {
            dropMeasuredHeights()
            refresh(rows: visibleRows(), remeasuring: true)
        }
        var affected = IndexSet()
        if fresh.selection.open != drawnOpen {
            // A row's id IS its position — assigned as one by `FeedProjection.rows`.
            affected.formUnion(IndexSet([drawnOpen, fresh.selection.open].compactMap(\.self)))
        }
        let unfolded = fresh.unfolded.wrappedValue
        let refolded = unfolded != folds
        if refolded {
            affected.formUnion(IndexSet(folds.symmetricDifference(unfolded)))
        }
        if fresh.washed != drawnWashed {
            affected.formUnion(IndexSet([drawnWashed, fresh.washed].compactMap(\.self)))
        }
        folds = unfolded
        drawnWashed = fresh.washed
        drawnOpen = fresh.selection.open
        guard !affected.isEmpty else { return }
        refresh(rows: affected, remeasuring: refolded)
    }
}
