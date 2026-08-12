import AppKit
import SwiftUI

/// The AppKit half of the feed: what the table draws, and the one thing that moves the scroll.
///
/// It decides nothing about WHERE the reading lands — that is `FeedScrollPolicy`'s, reached through
/// the handle. What stays here is AppKit facts only: the scroll view, the table, the
/// measured-height
/// cache, the ruler, and the keyboard's focused row.
@MainActor final class FeedTableCoordinator: NSObject {
    var model: FeedTableModel?
    /// The shared scroll authority, which holds the policy this coordinator reports to.
    weak var handle: FeedTableHandle?
    /// What the table currently draws, diffed against each fresh model — the table is not a
    /// SwiftUI view, so nothing re-renders it on a change.
    private(set) var shown: [FeedRow] = []
    private var folds: Set<FeedRow.ID> = []
    /// The open row the visible cells were last drawn against.
    private var drawnOpen: FeedRow.ID?
    /// The washed row they were last drawn against — see `FeedTableModel.washed`.
    private var drawnWashed: FeedRow.ID?
    /// Whether the last model arrived mid seam-drag — the edge off it is when the full
    /// re-measure runs.
    private var wasResizing = false

    weak var table: FeedTableView?
    weak var scroller: NSScrollView?

    /// The row the keyboard is on. The table's own fact, not `FocusState`'s — the rows live in
    /// separate hosting hierarchies now, and a focus value none of them can resolve is noise.
    var focusedRow: Int?
    /// The full re-measure waiting for a width burst to go quiet — see `FeedSettle`.
    var settling: Task<Void, Never>?

    /// Measured row heights, by row index — the cache behind `heightOfRow`.
    ///
    /// Manual heights rather than `usesAutomaticRowHeights`, and that is the scroll's frame
    /// budget: automatic heights answer through the constraint engine, where an `NSHostingView`
    /// runs THREE full SwiftUI layout passes per row scrolled in (its min, ideal and max size
    /// constraints). Profiled, not surmised — the stutter was that tower. A delegate height is
    /// one `sizeThatFits` against the ruler below, paid once per row per width.
    private var heights: [Int: CGFloat] = [:]
    /// The one view content is measured in — never installed in a window, reused per row, and
    /// building no sizing constraints of its own: `sizeThatFits` is asked directly.
    private let ruler: NSHostingController<AnyView> = {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        return ruler
    }()

    /// What an unmeasured row is assumed to stand at — a few lines of prose. An estimate close
    /// to the truth keeps the table from speculatively realising twice the rows a wheel tick
    /// will actually show, which is work thrown away at frame rate.
    nonisolated static let estimatedRowHeight: CGFloat = ArgoFeedRow.lineHeight * 3

    /// The tallest a single row may claim to be. Far above any real one, and far below AppKit's
    /// ±2^45 geometry window, which `NSTableView` leaves once summed origins pass it.
    nonisolated static let maxRowHeight: CGFloat = 100_000

    /// A measured height, or the estimate when it is one no row could truly stand at.
    ///
    /// Row content that flexes vertically takes the whole proposal, and the ruler proposes an
    /// unbounded one — a row measured at 1.2e308 turns the table's origin arithmetic into NaN and
    /// kills the window.
    nonisolated static func usableHeight(_ height: CGFloat) -> CGFloat {
        guard height.isFinite, height >= 0, height <= maxRowHeight else {
            return estimatedRowHeight
        }
        return height
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
        model = fresh
        shown = fresh.rows
        guard table != nil else { return }
        if fresh.rows == stale {
            touchUp(against: fresh, from: staleEnvironment)
        } else {
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
        // The lane draws the knob while it is up, so the platform's own would be a second one
        // between the reading and its map.
        scroller?.hasVerticalScroller = !fresh.hasMinimap
        place()
    }

    /// One `sizeThatFits` against the ruler, cached — see `heights`.
    func measuredHeight(at index: Int, in table: NSTableView) -> CGFloat {
        if let known = heights[index] {
            return known
        }
        let width = table.bounds.width
        guard let model, shown.indices.contains(index), width > 0 else {
            return Self.estimatedRowHeight
        }
        ruler.rootView = model.content(at: index)
        // Rounded UP to a whole point: a non-integral row height still blurs baselines on
        // current macOS, and up rather than to-nearest so text is never clipped by rounding.
        let height = Self.usableHeight(ceil(ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height))
        heights[index] = height
        // The ruler would otherwise keep the row's live view graph — tasks included — alive
        // in a controller no window ever shows.
        ruler.rootView = AnyView(EmptyView())
        return height
    }

    /// Measured heights surrendered — all of them for a re-wrap, or the rows named.
    func dropMeasuredHeights(_ rows: IndexSet? = nil) {
        guard let rows else { return heights.removeAll() }
        for row in rows {
            heights[row] = nil
        }
    }

    /// Re-draws and, when asked, re-measures the named rows. Cells exist only for realised rows,
    /// but a height note is honest for any row — which is what keeps a rewritten row that is OFF
    /// screen from coming back at its old height.
    func refresh(rows: IndexSet, remeasuring: Bool) {
        guard let table, let model else { return }
        let rows = rows.filteredIndexSet { shown.indices.contains($0) }
        for row in rows {
            let cell = table.view(atColumn: 0, row: row, makeIfNecessary: false) as? FeedRowCell
            cell?.host.rootView = model.content(at: row)
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

    func visibleRows() -> IndexSet {
        guard let table else { return [] }
        let visible = table.rows(in: table.visibleRect)
        return IndexSet(integersIn: visible.location ..< visible.location + visible.length)
    }

    /// The equal-rows path: nothing structural moved, so only what a cell DRAWS can be stale —
    /// and only the rows whose rendered fact changed are touched, because replacing a rootView
    /// resets whatever in-row state the reader had (a text selection, a hover).
    private func touchUp(against fresh: FeedTableModel, from staleEnvironment: EnvironmentValues?) {
        // A theme or type-size flip re-inks everything and retires every measured height.
        if staleEnvironment?.colorScheme != fresh.environment.colorScheme
            || staleEnvironment?.dynamicTypeSize != fresh.environment.dynamicTypeSize {
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
