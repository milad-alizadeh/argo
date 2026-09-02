import AppKit

// How a re-measure is PAID for. Which rows a decision names is `FeedScrollPolicy`'s and where the
// reading lands afterwards is the scrolling half's; what is here is the one fact those two cannot
// see: a height AppKit asks for is a full SwiftUI layout against the ruler, so a pass that asks for
// N of them inside one block is N layouts inside one frame (#856).

extension FeedTableCoordinator {
    func remeasure(_ scope: FeedRemeasure) {
        guard let table, let scroller else { return }
        switch scope {
        case .none:
            // Not a re-measure at all, so a tail already running is left to finish.
            return
        case .visible:
            tailing?.cancel()
            let rows = visibleRows()
            dropMeasuredHeights(rows)
            note(rows, on: table)
        case .all:
            remeasureEverything(on: table)
        case .rebuild:
            // No drop of its own. A row measured against an interim launch width is cached too
            // tall, and a reload re-asking that store would re-seat every row on the stale answer —
            // but a width retires the store on its own (`FeedGeometry.settle(at:in:)`), and rows
            // that re-numbered were dropped by `execute` before this ran. Emptying it here as
            // well is what made every return to the Sessions room re-measure a reading nothing had
            // changed about (#858).
            tailing?.cancel()
            table.reloadData()
        }
        // Forcing a layout from inside a notification handler is work proportional to the
        // document, and it can resize the clip view that posted the notification (#955).
        guard scope.forcesLayout else { return }
        scroller.layoutSubtreeIfNeeded()
    }

    /// Zero duration: this is a correction, not motion.
    func note(_ rows: IndexSet, on table: NSTableView) {
        NSAnimationContext.runAnimationGroup { pass in
            pass.duration = 0
            table.noteHeightOfRows(withIndexesChanged: rows)
        }
    }

    /// The full re-measure, chunked so it yields.
    ///
    /// `noteHeightOfRows` makes AppKit ask the delegate for each noted height synchronously, and a
    /// height with no cached answer is a full SwiftUI layout. So this NOTES rather than drops: the
    /// `Ground` a height was kept under already answers `nil` for a row that changed, and the width
    /// and the ink are the store's own — a re-wrap has retired every height before this runs
    /// (`FeedGeometry.settle(at:in:)`). Dropping on top of that made a `.all` pass over an
    /// UNCHANGED reading re-pay every layout in it, and `.all` is what every settle fires.
    ///
    /// The tail may not be dropped for lazy scroll-in measurement, however tempting — see
    /// `measureTail`.
    private func remeasureEverything(on table: NSTableView) {
        tailing?.cancel()
        // A prose row is measured off its markdown structure now (`FeedRowMeasure`), which makes
        // this pass a second whole-document walk through the same store the lane's is — so it holds
        // the store to the document for the same reason `reading()` does.
        ProseReading.holding(rows: shown.count)
        let visible = visibleRows()
        note(visible, on: table)
        let tail = IndexSet(shown.indices).subtracting(visible)
        guard !tail.isEmpty else { return }
        // Owed from here rather than from when the body starts — see `settleSoon()`.
        deferredPasses += 1
        tailing = Task { [weak self] in await self?.measureTail(tail) }
    }

    /// One batch a run-loop turn until every row is measured, or a fresher re-measure cancels it.
    ///
    /// It runs to the end rather than leaving the rest to be measured as they scroll in: the
    /// minimap is a miniature of the WHOLE document, so a row nobody has looked at still has to
    /// have a height.
    ///
    /// The reading is read before each batch and put back after it: the rows ABOVE the reader
    /// change height as they are measured, and each of those changes slides the reading out from
    /// under them. Read fresh each time rather than held, so a reader who scrolls mid-tail is
    /// followed rather than yanked back.
    private func measureTail(_ tail: IndexSet) async {
        // Owed for the whole tail, and paid back however it ends — see `deferredPasses`.
        defer { deferredPasses -= 1 }
        var pending = tail
        while !pending.isEmpty {
            guard !Task.isCancelled, let table else { return }
            let batch = take(from: &pending)
            // Resolved against the anchor read BEFORE the batch and landed after it — that pair IS
            // the holding.
            let held = handle?.resolve(.rowsMeasured(anchor: anchor()))
            // Noted, never dropped, for `remeasureEverything`'s reason: a height still true of its
            // row is re-used, and one that is not was already unfindable.
            note(batch, on: table)
            // Laid out inside the batch on purpose. A note alone only marks the rows; the heights
            // are asked for at the next layout, and leaving that to whenever one happens would pile
            // every batch's askings back into one block.
            scroller?.layoutSubtreeIfNeeded()
            land(held?.landing ?? .stay, over: nil)
            // A sleep and not a yield: what has to happen between batches is a turn of the RUN
            // LOOP, and a main-actor yield can be drained without one.
            try? await Task.sleep(for: .milliseconds(1))
        }
    }

    /// The next batch: whatever the reader can see, before anything they cannot.
    ///
    /// The landing happens AFTER the re-measure, so the rows a landing brought on screen were not
    /// in the set squared up in that frame — and a reader who scrolls mid-tail moves the viewport
    /// again. Either way the rows under their eye are the ones that go first.
    private func take(from pending: inout IndexSet) -> IndexSet {
        let onScreen = visibleRows().intersection(pending)
        let taken = IndexSet((onScreen.isEmpty ? pending : onScreen)
            .prefix(Self.remeasureBatch))
        pending.subtract(taken)
        return taken.filteredIndexSet { shown.indices.contains($0) }
    }
}
