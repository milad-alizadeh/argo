import AppKit
import SwiftUI

// The table's two vocabularies: what a row IS (data source and delegate), and what the keyboard
// does when it lands on one.

extension FeedTableCoordinator: NSTableViewDataSource, NSTableViewDelegate {
    func numberOfRows(in _: NSTableView) -> Int {
        shown.count
    }

    func tableView(_ table: NSTableView, viewFor _: NSTableColumn?, row index: Int) -> NSView? {
        guard let drawn, shown.indices.contains(index) else { return nil }
        // Recycled per shape — see `FeedRow.Content.Shape`. A pool shared across shapes hands a
        // cell the wrong tree and pays a full rebuild for every row a scroll exposes.
        let shape = shown[index].content.shape
        let cell = table.makeView(
            withIdentifier: FeedRowCell.reuse(shape),
            owner: nil,
        ) as? FeedRowCell
            ?? FeedRowCell(shape: shape)
        cell.host.rootView = drawn.content(at: index, hasCursor: index == cursorRow)
        exposures += 1
        return cell
    }

    func tableView(_ table: NSTableView, heightOfRow index: Int) -> CGFloat {
        measuredHeight(at: index, in: table)
    }

    /// Rows are never table-selected: what "selected" means here — the open row, the lit shot —
    /// is the deck's, drawn by the rows themselves.
    func tableView(_: NSTableView, shouldSelectRow _: Int) -> Bool {
        false
    }
}

extension FeedTableCoordinator {
    /// The row the cursor is actually drawn on. A focused row the keyboard has since left keeps
    /// its place, so the reader who clicks back into the reading arrows on from where they were.
    var cursorRow: Int? {
        hasKeyboard ? focusedRow : nil
    }

    /// The rows whose cursor may have changed, re-drawn and never re-measured: the cursor is an
    /// overlay, so a row is exactly as tall with one as without.
    func redrawCursor(_ rows: Int?...) {
        refresh(rows: IndexSet(rows.compactMap(\.self)))
    }

    func step(focusBy delta: Int) {
        guard let table, !shown.isEmpty else { return }
        let next = focusedRow.map { $0 + delta } ?? landing(delta, in: table)
        let landed = min(max(next, 0), shown.count - 1)
        focusedRow = landed
        table.scrollRowToVisible(landed)
        // A key is a hand too: arrowing up off the end has to break the follow latch, or the
        // next arriving row yanks the reading straight back to the bottom mid-read.
        reportFollowing()
    }

    /// Where the FIRST arrow key lands, when there is no cursor to step from.
    ///
    /// On a row the reader can already see, and not one step past it: the cursor is drawn now
    /// (#533), so a first press that skipped the row under it would read as the key missing. Down
    /// takes the top of the view and up the bottom, because that is the end each is reaching for —
    /// a reading following the newest row is arrowed UP to start reading back through it.
    private func landing(_ delta: Int, in table: NSTableView) -> Int {
        let visible = table.rows(in: table.visibleRect)
        return delta < 0 ? visible.location + max(visible.length - 1, 0) : visible.location
    }

    /// What Edit ▸ Copy takes: the focused row's own words, or `nil` where there is nothing
    /// verbatim to hand over. `copyable`, so a focused prompt answers the key that a bubble draws
    /// no
    /// chip for.
    var focusedWords: String? {
        guard let index = focusedRow, shown.indices.contains(index) else { return nil }
        return shown[index].kind.words
    }

    func activateFocusedRow() -> Bool {
        guard let drawn, let index = focusedRow, shown.indices.contains(index) else { return false }
        let row = shown[index]
        return row.activate(selection: drawn.selection, isExpanded: drawn.unfolding(row.id))
    }

    /// The deck handing the keyboard back — `FeedRowSelection.close()` names a row, and the row
    /// is here now rather than in the deck's focus space.
    ///
    /// - Parameter byKey: whether the reader got here by a key. `nil` asks the press in hand,
    ///   which is the app's own answer; a surface with no events at all states it instead — a
    ///   specimen cannot press Escape, and a still that drew no cursor would be a still of a
    ///   state the app does not have (`FeedPreview`).
    func focus(onto id: FeedRow.ID, byKey: Bool? = nil) {
        guard let table, let index = shown.firstIndex(where: { $0.id == id }) else { return }
        focusedRow = index
        table.scrollRowToVisible(index)
        table.window?.makeFirstResponder(table)
        // The hand-back preserves how the reader was working rather than deciding it (#533):
        // Escape out of the panel arrives on a key, its close button on a click. Stated here and
        // not left to the responder change, which is silent when the table already held the keys.
        //
        // Of the PRESS in hand, not of the cockpit's reader: this is also the backstop every
        // surface that writes a row into the focus space lands on (`FeedView`), and a reader whose
        // last key was in the composer never asked this reading for a cursor (#1180).
        noteKeyboard(byKey ?? table.isKeyDriven)
        reportFollowing()
    }
}
