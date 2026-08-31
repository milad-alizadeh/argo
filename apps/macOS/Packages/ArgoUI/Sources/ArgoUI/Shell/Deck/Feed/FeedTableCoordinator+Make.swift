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
        // The gutters at each end are `apply`'s — both move with what floats there. Turning the
        // automatic ones off is what lets it own them.
        scroller.automaticallyAdjustsContentInsets = false
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
        table.reshaped = { [weak self] in self?.notedReshape() }
        table.keyboardMoved = { [weak self] isHere in self?.noteKeyboard(isHere) }
        table.focusedWords = { [weak self] in self?.focusedWords }
        return table
    }
}
