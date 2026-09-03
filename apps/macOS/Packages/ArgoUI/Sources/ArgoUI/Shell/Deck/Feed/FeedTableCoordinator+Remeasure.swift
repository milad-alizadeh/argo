import AppKit

// What is left of the re-measure path once no height is worked out on it.
//
// Until ADR-0030 this was where a `FeedRemeasure` decision was PAID for: a height AppKit asked for
// was worked out or typeset on the spot, so a pass that asked for N of them inside one block paid
// all of it inside one frame (#856) — and the tail of the document had to be chunked across run
// loop turns to keep that off the frame budget. None of that exists now. A height is an array read
// off the settled document, so a note is a note: the table re-asks, and the answers were decided
// before it drew its first row.
//
// The vocabulary stays because it is the scroll policy's, not the table's: `FeedScrollPolicy` says
// which rows a decision touches, and this says what the table does about it.

extension FeedTableCoordinator {
    func remeasure(_ scope: FeedRemeasure) {
        guard let table, let scroller else { return }
        switch scope {
        case .none:
            return
        case .visible:
            note(visibleRows(), on: table)
        case .all:
            note(IndexSet(shown.indices), on: table)
        case .rebuild:
            table.reloadData()
        }
        // Forcing a layout from inside a notification handler is work proportional to the
        // document, and it can resize the clip view that posted the notification (#955).
        guard scope.forcesLayout else { return }
        scroller.layoutSubtreeIfNeeded()
    }

    /// Zero duration: this is a correction, not motion. Left to the default, every unfolded prompt
    /// would ease the rows below it down.
    func note(_ rows: IndexSet, on table: NSTableView) {
        guard !rows.isEmpty else { return }
        NSAnimationContext.runAnimationGroup { pass in
            pass.duration = 0
            table.noteHeightOfRows(withIndexesChanged: rows)
        }
    }
}
