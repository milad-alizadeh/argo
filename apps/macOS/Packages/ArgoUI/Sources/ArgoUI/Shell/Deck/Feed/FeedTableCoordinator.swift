import AppKit
import SwiftUI

/// The AppKit half of the feed: what the table draws, and how a fresh reading lands on it.
///
/// It never decides whether the reading follows — that stays `FeedView`'s — but it is the only
/// thing that moves the scroll. The split is what killed the old feed's bugs: exactly one
/// authority over the offset, and it is the one AppKit already runs.
@MainActor final class FeedTableCoordinator: NSObject {
    var model: FeedTableModel?
    /// What the table currently draws, diffed against each fresh model. The table is not a
    /// SwiftUI view: nothing re-renders it, so what changed has to be said out loud.
    private(set) var shown: [FeedRow] = []
    private var folds: Set<FeedRow.ID> = []
    /// The open row the visible cells were last drawn against.
    private var drawnOpen: FeedRow.ID?
    /// Whether the last model arrived mid seam-drag — the edge off it is when the full
    /// re-measure runs.
    private var wasResizing = false

    weak var table: FeedTableView?
    weak var scroller: NSScrollView?

    /// Whether the opening scroll has been made. Reset when the reading empties, so the same
    /// view opening a fresh record opens it at the end again.
    var placed = false
    /// A generation on the opening passes: the reader's first own scroll bumps it, and any pass
    /// still queued finds itself stale — an open must never out-scroll a hand.
    var opening = 0
    /// The row the keyboard is on. The table's own fact, not `FocusState`'s — the rows live in
    /// separate hosting hierarchies now, and a focus value none of them can resolve is noise.
    var focusedRow: Int?
    /// The pane width last laid out against — what tells a re-wrap from a plain height change.
    var paneWidth: CGFloat = 0
    /// The full re-measure waiting for a width burst to go quiet — see `paneChanged`.
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
    static let estimatedRowHeight: CGFloat = ArgoFeedRow.lineHeight * 3

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// A fresh reading, applied as the difference from the shown one. Appends are the live case
    /// and stay appends — a reload would tear down every visible cell once per arriving row.
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
        guard let table else { return }
        if fresh.rows == stale {
            touchUp(against: fresh, from: staleEnvironment)
        } else {
            reshape(from: stale, on: table)
        }
        // The seam letting go is the moment the width is final: one full re-measure squares
        // every off-screen row that rode the drag on a stale height.
        if wasResizing, !fresh.isResizing {
            settleAfterResize()
        }
        wasResizing = fresh.isResizing
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
        let height = ceil(ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height)
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
        folds = unfolded
        drawnOpen = fresh.selection.open
        guard !affected.isEmpty else { return }
        refresh(rows: affected, remeasuring: refolded)
    }

    private func reshape(from stale: [FeedRow], on table: NSTableView) {
        if shown.count >= stale.count, shown.starts(with: stale.dropLast()) {
            // The append fast path — the live case. The last stale row is left out of the
            // prefix on purpose: a live transcript rewrites its newest row as the call in it
            // is answered, sometimes with rows appended after it and sometimes alone.
            if shown.count > stale.count {
                table.insertRows(at: IndexSet(stale.count ..< shown.count), withAnimation: [])
            }
            if let rewritten = stale.indices.last {
                refresh(rows: IndexSet(integer: rewritten), remeasuring: true)
            }
        } else {
            dropMeasuredHeights()
            table.reloadData()
        }
        if model?.isFollowing == true {
            scrollToEnd(over: nil)
        }
    }
}
