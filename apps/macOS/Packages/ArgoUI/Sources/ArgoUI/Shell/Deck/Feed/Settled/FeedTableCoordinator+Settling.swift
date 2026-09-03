import AppKit

// When a measure runs, and what the table does when one lands. The measuring itself is
// `FeedMeasurePass`', off the main actor; what is here is the main actor's half — the stamp, the
// decision, and the one atomic moment the fresh geometry is put on screen (ADR-0030, Rule 3).

extension FeedTableCoordinator {
    /// The reading measured, if anything is owed. Asked from the two places a stamp can change:
    /// a fresh model arriving, and the pane resolving to another width.
    func settleIfOwed() {
        // Re-entrant by construction: landing a document reloads the table, which lays it out,
        // which moves the table's frame, which is where this is asked from (`reshaped()`). One
        // decision at a time — the pass a nested ask would owe is the same one the outer ask is
        // already answering.
        guard !isDecidingSettle else { return }
        isDecidingSettle = true
        defer { isDecidingSettle = false }
        guard let table, let model, table.bounds.width > 0, !model.isResizing else { return }
        // An empty reading is not a reading that shrank to nothing: it is a deck standing in for
        // one — a Session whose reading has not been taken yet (`DrawnSession`), or a room whose
        // deck is off screen — and the document held is still true of the rows on their way back.
        // Surrendered here, a switch away and back would measure the whole reading twice, which is
        // the cost `FeedGeometries` exists to have removed (#858).
        guard !model.rows.isEmpty else { return drawNothing() }
        let stamp = FeedMeasureStamp(of: model, atWidth: table.bounds.width)
        switch FeedMeasureDelta.between(geometry.settled, and: stamp) {
        case .settled:
            // Nothing to measure, and possibly everything still to SHOW: a table built fresh over a
            // store the shell kept has a whole document and has drawn none of it. That is the
            // ordinary room switch — the cost this lane is about — and it is the one path where a
            // document arrives without a pass to land it (#858).
            adoptSettled()
        case .whole:
            // A re-wrap of the reading that stands is a WIDTH that moved, and a width arrives as a
            // burst — one frame per frame of a drag. Measuring each of them is a document per
            // frame thrown away, so the pass waits for the quiet after the last one and the rows
            // ride the drag at the wrap they have (ADR-0030, Rule 6). Nothing is surrendered
            // there: blanking the deck on a drag frame is the flash the delay exists to stop.
            guard geometry.settled?.stamp.isReading(of: stamp) != true else {
                return settleWhenQuiet()
            }
            surrenderDocument()
            settle(stamp, measuring: nil)
        case let .rows(owed):
            settle(stamp, measuring: owed)
        }
    }

    /// The table emptied without the document being — see `settleIfOwed`.
    ///
    /// A deck holding a document keeps drawing it. The empty feed is the shell's deferral, not a
    /// reading that emptied: the pass that paints a click hands the deck it is coming back to no
    /// rows (`DrawnSession`), and a deck that blanked itself for that pass would throw away the
    /// offset the reader left it at — which is the whole of what ADR-0030 Rule 4 keeps.
    private func drawNothing() {
        guard !shown.isEmpty, !geometry.isSettled else { return }
        shown = []
        handle?.drawing(0)
        table?.reloadData()
        notedReshape()
    }

    /// The document that stands, put on screen where the table is not already drawing it.
    private func adoptSettled() {
        guard let table, let document = geometry.settled, shown != document.stamp.rows else {
            return
        }
        let stale = shown
        show(document.stamp.rows, against: stale, freshly: stale.isEmpty, on: table)
        handle?.settled(true)
        place()
    }

    /// The quiet after the last frame of a width burst, and the pass it was waiting for.
    ///
    /// The ONE wait, reached from both places a burst is seen: a pane that resolved to another
    /// size, and a stamp whose width no longer matches the document that stands. Two waits was two
    /// timers on the same 250 ms, and `isMeasuring` could only see one of them.
    ///
    /// The pass already running is retired with it. Its answer is a document of the width the
    /// reader has just left, and the rows on screen stand at the wrap the SETTLED document gave
    /// them either way — where a drag that let every frame's pass finish would measure the whole
    /// document once a frame.
    func settleWhenQuiet() {
        settling?.cancel()
        settlingFor = nil
        quieting?.cancel()
        quieting = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(Self.quietMilliseconds))
            guard !Task.isCancelled else { return self?.finishedQuiet() ?? () }
            self?.settleAfterQuiet()
        }
    }

    /// The pass a burst deferred, at the width the burst ended on.
    ///
    /// It measures rather than asking again: `settleIfOwed` would read the same re-wrap it read
    /// when it armed this wait and arm another, which is a wait that never ends.
    private func settleAfterQuiet() {
        finishedQuiet()
        settleElapsed()
        guard let table, let model, table.bounds.width > 0 else { return }
        let stamp = FeedMeasureStamp(of: model, atWidth: table.bounds.width)
        guard case .whole = FeedMeasureDelta.between(geometry.settled, and: stamp) else {
            return settleIfOwed()
        }
        settle(stamp, measuring: nil)
    }

    /// How long after a width frame the pass runs, where nothing else has arrived meanwhile. The
    /// same wait `FeedScrollPolicy` settles a burst over, for the same reason.
    static let quietMilliseconds = 250

    /// One pass in flight at a time. A fresher stamp cancels the one before it: its answer is a
    /// document of a reading, a width or a standing that has since moved.
    private func settle(_ stamp: FeedMeasureStamp, measuring owed: IndexSet?) {
        guard settlingFor != stamp else { return }
        quieting?.cancel()
        finishedQuiet()
        settling?.cancel()
        settlingFor = stamp
        let measuring = owed?.count ?? stamp.rows.count
        let standing = geometry.settled
        settling = Task { [weak self] in
            let document = await Self.measured(stamp, measuring: owed, over: standing)
            guard !Task.isCancelled else { return }
            self?.noted(measuring)
            self?.landed(document, for: stamp)
        }
    }

    /// The pass. `owed` names the rows a live Session grew or a late Result changed, which are
    /// measured over the document that stands; everything else is the whole reading.
    private static func measured(
        _ stamp: FeedMeasureStamp,
        measuring owed: IndexSet?,
        over standing: FeedSettledDocument?,
    )
        async -> FeedSettledDocument? {
        guard let owed, let standing else { return await FeedMeasurePass.settle(stamp) }
        return await standing.replacing(FeedMeasurePass.measure(owed, of: stamp), against: stamp)
    }

    /// The fresh geometry put on screen, in one turn of the main actor.
    ///
    /// Atomic on purpose, and this is the whole of ADR-0030's promise: the rows the table draws,
    /// the heights it draws them at and the document the overview lane maps all change together,
    /// so there is no frame in which the feed is showing one reading's rows at another's heights.
    private func landed(_ document: FeedSettledDocument?, for stamp: FeedMeasureStamp) {
        guard let document, let table, settlingFor == stamp else { return }
        settlingFor = nil
        // Read BEFORE the heights move and landed after them — that pair IS the holding, and it is
        // what keeps a late Result from scrolling the reader away from what they were reading.
        let held = handle?.resolve(.rowsMeasured(anchor: anchor()))
        let stale = shown
        let wasSettled = geometry.isSettled
        geometry.settle(document)
        show(document.stamp.rows, against: stale, freshly: !wasSettled, on: table)
        handle?.settled(true)
        // Before the layout below, for `place()`'s reason.
        place()
        // The reading laid out at its final heights before anything is asked where a row IS:
        // `reloadData` marks and defers, so a lane reading the document height here would read the
        // one the table had before. Safe on this path and not on the ones #955 is about — this is
        // a turn of the main actor of its own, not a frame-change handler.
        scroller?.layoutSubtreeIfNeeded()
        land(held?.landing ?? .stay, over: nil)
    }

    /// The rows the table draws now, and the cheapest true way to get from the ones it drew.
    private func show(
        _ rows: [FeedRow],
        against stale: [FeedRow],
        freshly: Bool,
        on table: NSTableView,
    ) {
        shown = rows
        handle?.drawing(rows.count)
        guard !freshly, !stale.isEmpty else {
            // The reading OPENS here. `openAfresh` reopened the policy on the rows the table had,
            // which for a reading nobody had measured yet was none of them — so where a landing is
            // the first rows this table has drawn, the policy is given them now. Without it the
            // reading opens at the top of a feed that opens at its tail (ADR-0029), and the follow
            // latch names a row in a reading of no rows.
            handle?.reopen(on: rows, held: model?.held)
            table.reloadData()
            // Noted as well as reloaded: `reloadData` marks the rows and defers, and until the
            // heights are asked for the table stands at the height of its clip view rather than of
            // its document — which is the height the opening scroll is aimed against.
            note(IndexSet(rows.indices), on: table)
            notedReshape()
            return
        }
        decide(.rowsChanged(from: stale, to: rows))
        // The policy decides how the rows ARRIVE — an append keeps every cell on screen, a reload
        // tears them down — and it may decide neither, because a decision is about scrolling. The
        // table drawing the document it opens on is not negotiable, so a count that did not follow
        // is reloaded here.
        if table.numberOfRows != rows.count {
            table.reloadData()
        }
        note(IndexSet(rows.indices), on: table)
        notedReshape()
    }
}
