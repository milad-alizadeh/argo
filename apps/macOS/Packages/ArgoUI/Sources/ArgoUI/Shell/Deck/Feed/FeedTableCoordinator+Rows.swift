import AppKit
import SwiftUI

// The table's two vocabularies: what a row IS (data source and delegate), and what the keyboard
// does when it lands on one.

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
    func step(focusBy delta: Int) {
        guard let table, !shown.isEmpty else { return }
        let standing = focusedRow ?? table.rows(in: table.visibleRect).location
        let next = min(max(standing + delta, 0), shown.count - 1)
        focusedRow = next
        table.scrollRowToVisible(next)
        // A key is a hand too: arrowing up off the end has to break the follow latch, or the
        // next arriving row yanks the reading straight back to the bottom mid-read.
        reportFollowing()
    }

    func activateFocusedRow() -> Bool {
        guard let model, let index = focusedRow, shown.indices.contains(index) else { return false }
        let row = shown[index]
        return row.activate(selection: model.selection, isExpanded: model.unfolding(row.id))
    }

    /// The deck handing the keyboard back — `FeedRowSelection.close()` names a row, and the row
    /// is here now rather than in the deck's focus space.
    func focus(onto id: FeedRow.ID) {
        guard let table, let index = shown.firstIndex(where: { $0.id == id }) else { return }
        focusedRow = index
        table.scrollRowToVisible(index)
        table.window?.makeFirstResponder(table)
        reportFollowing()
    }
}
