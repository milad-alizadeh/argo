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
    /// What the visible cells were last drawn against — the deck state a row renders.
    private var drawn: (open: FeedRow.ID?, lit: FeedShot?) = (nil, nil)

    weak var table: FeedTableView?
    weak var scroller: NSScrollView?

    /// Whether the opening scroll has been made. Reset when the reading empties, so the same
    /// view opening a fresh record opens it at the end again.
    var placed = false
    /// The row the keyboard is on. The table's own fact, not `FocusState`'s — the rows live in
    /// separate hosting hierarchies now, and a focus value none of them can resolve is noise.
    var focusedRow: Int?
    /// The pane width last laid out against — what tells a re-wrap from a plain height change.
    var paneWidth: CGFloat = 0

    /// Measured row heights, by row index — the cache behind `heightOfRow`.
    ///
    /// Manual heights rather than `usesAutomaticRowHeights`, and that is the scroll's frame
    /// budget: automatic heights answer through the constraint engine, where an `NSHostingView`
    /// runs THREE full SwiftUI layout passes per row scrolled in (its min, ideal and max size
    /// constraints). Profiled, not surmised — the stutter was that tower. A delegate height is
    /// one `sizeThatFits` against the ruler below, paid once per row per width.
    private var heights: [Int: CGFloat] = [:]
    /// The one view content is measured in — never installed in a window, reused per row.
    private let ruler = NSHostingController(rootView: AnyView(EmptyView()))

    /// What an unmeasured row is assumed to stand at — a few lines of prose. An estimate close
    /// to the truth keeps the table from speculatively realising twice the rows a wheel tick
    /// will actually show, which is work thrown away at frame rate.
    static let estimatedRowHeight: CGFloat = ArgoFeedRow.lineHeight * 3

    func makeScrollView() -> NSScrollView {
        let table = makeTable()
        let scroller = NSScrollView()
        scroller.documentView = table
        scroller.hasVerticalScroller = true
        scroller.drawsBackground = false
        // The feed's own gutters: the breath above the first row, and the one under the last
        // that "back to the newest line" lands on. Insets rather than spacer rows, so the
        // reading's content is exactly its rows.
        scroller.automaticallyAdjustsContentInsets = false
        scroller.contentInsets = NSEdgeInsets(
            top: ArgoSpacing.section, left: 0, bottom: ArgoSpacing.section, right: 0,
        )
        self.table = table
        self.scroller = scroller
        watch(scroller)
        return scroller
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
        let refolded = fresh.unfolded.wrappedValue != folds
        let redrawn = refolded
            || fresh.selection.open != drawn.open
            || fresh.selection.lit != drawn.lit
        model = fresh
        shown = fresh.rows
        folds = fresh.unfolded.wrappedValue
        drawn = (fresh.selection.open, fresh.selection.lit)
        guard let table else { return }
        if fresh.rows == stale {
            if redrawn {
                refresh(remeasuring: refolded)
            }
        } else {
            reshape(from: stale, on: table)
        }
        place()
    }

    private func makeTable() -> FeedTableView {
        let table = FeedTableView()
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("feed"))
        column.resizingMask = .autoresizingMask
        table.addTableColumn(column)
        table.headerView = nil
        table.rowHeight = Self.estimatedRowHeight
        table.intercellSpacing = .zero
        table.style = .plain
        table.backgroundColor = .clear
        table.selectionHighlightStyle = .none
        table.focusRingType = .none
        table.dataSource = self
        table.delegate = self
        table.stepFocus = { [weak self] delta in self?.step(focusBy: delta) }
        table.activateFocused = { [weak self] in self?.activateFocusedRow() ?? false }
        return table
    }

    private func reshape(from stale: [FeedRow], on table: NSTableView) {
        if shown.count > stale.count, shown.starts(with: stale.dropLast()) {
            // The append fast path. The last stale row is left out of the prefix on purpose: a
            // live transcript rewrites its newest row as the call in it is answered, and that
            // rewrite arrives with the rows appended after it. The refresh below re-draws it,
            // and its measured height goes with it whether or not it is on screen.
            heights[stale.count - 1] = nil
            table.insertRows(at: IndexSet(stale.count ..< shown.count), withAnimation: [])
            refresh(remeasuring: true)
        } else {
            heights.removeAll()
            table.reloadData()
        }
        if model?.isFollowing == true {
            scrollToEnd(over: nil)
        }
    }

    /// Re-draws the visible cells from the current model. Everything off screen is drawn fresh
    /// by the table when it scrolls in, so the visible ones are the only stale copies there are.
    private func refresh(remeasuring: Bool) {
        guard let table, let model else { return }
        let visible = table.rows(in: table.visibleRect)
        let rows = IndexSet(integersIn: visible.location ..< visible.location + visible.length)
            .filteredIndexSet { shown.indices.contains($0) }
        for row in rows {
            let cell = table.view(atColumn: 0, row: row, makeIfNecessary: false) as? FeedRowCell
            cell?.host.rootView = model.content(at: row)
        }
        guard remeasuring, !rows.isEmpty else { return }
        for row in rows {
            heights[row] = nil
        }
        // Zero duration: this is a correction, not motion. Left to the default, every unfolded
        // prompt would ease the rows below it down.
        NSAnimationContext.runAnimationGroup { pass in
            pass.duration = 0
            table.noteHeightOfRows(withIndexesChanged: rows)
        }
    }

    /// Every measured height, surrendered — the re-wrap case, where a new column width makes
    /// all of them answers to a question nobody is asking any more.
    func dropMeasuredHeights() {
        heights.removeAll()
    }
}

extension FeedTableCoordinator: NSTableViewDataSource, NSTableViewDelegate {
    func numberOfRows(in _: NSTableView) -> Int {
        shown.count
    }

    func tableView(_ table: NSTableView, viewFor _: NSTableColumn?, row index: Int) -> NSView? {
        guard let model, shown.indices.contains(index) else { return nil }
        let cell = table.makeView(withIdentifier: FeedRowCell.reuse, owner: nil) as? FeedRowCell
            ?? FeedRowCell()
        cell.host.rootView = model.content(at: index)
        return cell
    }

    /// One `sizeThatFits` against the ruler, once per row per width — see `heights`.
    func tableView(_ table: NSTableView, heightOfRow index: Int) -> CGFloat {
        if let known = heights[index] {
            return known
        }
        let width = table.bounds.width
        guard let model, shown.indices.contains(index), width > 0 else {
            return Self.estimatedRowHeight
        }
        ruler.rootView = model.content(at: index)
        let height = ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height
        heights[index] = height
        return height
    }

    /// Rows are never table-selected: what "selected" means here — the open row, the lit shot —
    /// is the deck's, drawn by the rows themselves.
    func tableView(_: NSTableView, shouldSelectRow _: Int) -> Bool {
        false
    }
}
