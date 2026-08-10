import AppKit
import SwiftUI

// The one place the scroller and its table are configured — built once per representable.

extension FeedTableCoordinator {
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
        table.keyScrolled = { [weak self] in self?.reportFollowing() }
        table.liveResizeEnded = { [weak self] in self?.settleAfterResize() }
        return table
    }
}
