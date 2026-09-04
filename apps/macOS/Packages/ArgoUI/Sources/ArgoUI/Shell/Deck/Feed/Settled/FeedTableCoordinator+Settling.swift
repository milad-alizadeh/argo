import AppKit
import ArgoDesign

// When a measure runs, and what the table does when one lands. The measuring itself is
// `FeedMeasurePass`', off the main actor; what is here is the main actor's half — the stamp, the
// decision, and the one atomic moment the fresh geometry is put on screen (ADR-0030, Rule 3).

extension FeedTableCoordinator {
    /// The reading measured, if anything is owed. Asked from the two places a stamp can change:
    /// a fresh model arriving, and the pane resolving to another width.
    ///
    /// `promptly` says the width is a fact rather than a frame of a drag — the seam or the window
    /// has just been let go of, or a burst's quiet has run out. A re-wrap is then measured now
    /// instead of arming the wait that a live width is ridden out on.
    func settleIfOwed(promptly: Bool = false) {
        // Re-entrant by construction: landing a document reloads the table, which lays it out,
        // which moves the table's frame, which is where this is asked from (`reshaped()`). One
        // decision at a time — the pass a nested ask would owe is the same one the outer ask is
        // already answering.
        guard !isDecidingSettle else { return }
        isDecidingSettle = true
        defer { isDecidingSettle = false }
        // Frozen for the length of a drag (ADR-0030, Rule 6): the rows keep the heights they were
        // measured at and the content is clipped, because a document measured against a width the
        // reader is still moving is one the next frame throws away.
        guard let table, let model, table.bounds.width > 0, !isDragging else { return }
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
            if geometry.settled?.stamp.stands(under: stamp) != true {
                surrenderDocument()
            } else if !promptly {
                return settleWhenQuiet()
            }
            settle(stamp, measuring: nil)
        case let .rows(owed):
            settle(stamp, measuring: owed)
        }
    }

    /// The settled document surrendered, because it is a document of a reading that is no longer
    /// being shown. Its absence is what puts the deck in its provisional state.
    func surrenderDocument() {
        // Nothing to surrender is nothing to do, and saying so is not tidiness: a reload moves the
        // table's frame, which is where a settle is decided from (`reshaped()`) — so a surrender
        // that reloaded an already-empty table would reload it again on the frame change it caused,
        // for as long as the pass it is waiting on takes to land.
        guard geometry.isSettled || !shown.isEmpty else { return }
        geometry.surrender()
        shown = []
        handle?.settled(false)
        handle?.drawing(false)
        table?.reloadData()
    }

    /// The table emptied without the document being — see `settleIfOwed`.
    ///
    /// A deck holding a document keeps drawing it. The empty feed is the shell's deferral, not a
    /// reading that emptied: the pass that paints a click hands the deck it is coming back to no
    /// rows (`DrawnSession`), and a deck that blanked itself for that pass would throw away the
    /// offset the reader left it at — which is the whole of what ADR-0030 Rule 4 keeps.
    ///
    /// The two cases are not otherwise tellable apart here, and they do not have to be: a settled
    /// reading cannot empty. The streams under one are append-only, which is the same property
    /// `SessionsRoomReadingCache` stamps a remembered reading on.
    private func drawNothing() {
        guard !shown.isEmpty, !geometry.isSettled else { return }
        shown = []
        handle?.drawing(false)
        table?.reloadData()
        notedReshape()
    }

    /// The document that stands, put on screen where the table is not already drawing it.
    private func adoptSettled() {
        guard let table, let document = geometry.settled else { return }
        guard shown != document.stamp.rows else { return }
        let stale = shown
        show(document.stamp.rows, against: stale, freshly: stale.isEmpty, on: table)
        handle?.settled(true)
        // The same walk the landing takes, and this path needs it MORE: no pass runs here, so
        // nothing will ever correct AppKit's row geometry afterwards (#1132). Whole document,
        // because a table built fresh over a kept store has resolved none of it.
        converge(table)
        #if DEBUG
            let last: Int = table.numberOfRows - 1
            let lastRect: NSRect = table.rect(ofRow: last)
            let asked: CGFloat = measuredHeight(at: last, in: table)
            print("ADOPT-DIAG rows=\(table.numberOfRows) doc=\(document.totalHeight) " +
                "afterWalk=\(table.frame.height) lastRect=\(lastRect) " +
                "delegateLast=\(asked) rowHeight=\(table.rowHeight)")
        #endif
        adopt(document.totalHeight, on: table)
        #if DEBUG
            print("ADOPT-DIAG afterAdopt=\(table.frame.height)")
            scroller?.layoutSubtreeIfNeeded()
            print("ADOPT-DIAG afterLayout=\(table.frame.height) last=\(table.rect(ofRow: last))")
        #endif
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
        releaseHold()
        quieting?.cancel()
        quieting = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(Self.quietMilliseconds))
            guard !Task.isCancelled else { return self?.finishedQuiet() ?? () }
            self?.settleAfterQuiet()
        }
    }

    /// The pass a burst deferred, at the width the burst ended on.
    ///
    /// `promptly`, because asking again the ordinary way would read the same re-wrap this wait was
    /// armed for and arm another — a wait that never ends.
    private func settleAfterQuiet() {
        finishedQuiet()
        settleElapsed()
        // A quiet that ran out with an edge still in the reader's hand — a drag that paused rather
        // than finished — is held by `settleIfOwed`'s own freeze, and the pass it owes runs when
        // the hand lets go (`settleAfterResize`).
        settleIfOwed(promptly: true)
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
        // A re-wrap over a document that stands: the rows on screen are drawn at the wrap the
        // reader has just left, and they are kept for as long as that reads as a swap rather than
        // as a hang.
        if owed == nil, geometry.isSettled {
            holdDocument()
        }
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
        // The latch comes back FIRST, and on every way out of here (#1132). Nothing else can give
        // it back: the only other writes to it are the ones a pass makes when it STARTS. So a pass
        // that returns with no document — or returns to a deck `KeptDecks` has evicted, since
        // `table` is weak — would leave a permanently `isMeasuring` coordinator, which is a
        // permanently provisional lane, which is a lane that never walks again and draws one
        // reading's miniature over another's feed until the app is quit (ADR-0030, Rule 3).
        guard settlingFor == stamp else { return }
        settlingFor = nil
        // With the latch, and for the same reason. `surrendersHeld` IS `settlingFor != nil`, so a
        // hold left armed past the line above can never fire: the clock runs out, reads that no
        // pass is in flight, and returns — leaving the deck drawing rows at a wrap that is no
        // longer true, with nothing on its way to replace them. ADR-0030 Rule 6 holds the stale
        // document so a drag does not blank the deck AND gives it up so the reader is not left in
        // front of it; this is the second half.
        releaseHold()
        // A table that has gone is a deck `KeptDecks` evicted, and its document is kept ON PURPOSE
        // — surrendering it here would throw away the store that makes coming back free (#858).
        //
        // A nil document is not reachable and is not handled as though it were: a pass returns one
        // only when a row went unmeasured, which happens only under cancellation, and every writer
        // of `settlingFor` cancels the pass in the same breath — so a cancelled pass always meets a
        // changed stamp and dies on the guard above.
        guard let document, let table else { return }
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
        // Before the layout, not after: the walk tiles the table, and a walk taken on the far side
        // of the layout would be a second one. `FeedRemeasureCostTests` holds the landing to
        // exactly one.
        converge(table)
        scroller?.layoutSubtreeIfNeeded()
        land(held?.landing ?? .stay, over: nil)
    }

    /// The document of the width the reader has LEFT, held while the pass for the width they
    /// landed on runs — and given up once that wait outlasts the motion ceiling.
    ///
    /// Neither half is optional. A drag that ends on a reading Argo measures inside a frame must
    /// not blank the feed for that frame, which is why the stale document is not surrendered
    /// outright; a drag that ends on the largest Session leaves the reader in front of rows at a
    /// wrap that is no longer true for up to three seconds, which is why it is not held for ever.
    /// `ArgoMotion.unreadDelay` is the line between the two, and past it the deck says the same
    /// word a first open says and the overview lane goes absent with it (ADR-0030, Rule 6).
    private func holdDocument() {
        holding?.cancel()
        holding = Task { [weak self] in
            try? await Task.sleep(for: .seconds(ArgoMotion.unreadDelay))
            guard !Task.isCancelled else { return }
            self?.surrenderHeld()
        }
    }

    /// AppKit's own row geometry brought up to the document that just landed (#1132).
    ///
    /// `NSTableView` sizes its document view lazily: until something asks after a row, that row
    /// stands at `rowHeight` — the three-line placeholder — however tall the delegate says it is.
    /// Over the 459-row synthetic the table's document view read 33 096pt against a settled
    /// document of 41 759, and placed the last row 8 663pt above where it belongs. A fifth of the
    /// reading.
    ///
    /// It does not converge by scrolling and it does not converge by tiling: `tile()` moved it
    /// nothing, `noteHeightOfRows` over every row moved it 938pt, and setting the frame outright
    /// was taken straight back by the next tile. It converges only as rows are ASKED after — so
    /// left alone the scrollable range grows under the reader as they scroll, which is the jitter,
    /// and the overview lane maps the settled document's own heights (Rule 7) against a table that
    /// does not yet agree it has them, which is the miniature drawn past the end of the feed.
    ///
    /// One walk is what converges it, and it costs 0.58µs a row measured cold. ADR-0028 Rule 2
    /// forbids work proportional to the document in a NOTIFICATION HANDLER; this is a turn of the
    /// main actor of its own, on the path that already lays the whole reading out a line above.
    ///
    /// WHOLE document, every time, and a tail append is not an exception. Walking only from the
    /// first row whose height moved looks sound — everything above it was converged by the landing
    /// before — but it is not: `show` reloads the table, and a reload drops AppKit's row cache
    /// wholesale rather than from the changed row down. Measured, an append of twelve rows to the
    /// 459-row synthetic left the table 8 819pt short of its own document that way. This is the
    /// Rule 1 shape ADR-0028 warns about, kept deliberately, because the alternative is a document
    /// the reader can scroll past the end of.
    ///
    /// It must run after `FeedMeasureStamp.rewraps` learned to compare the measure rather than the
    /// width: a tile taken from inside these getters reports a frame change, and while that was
    /// read as a re-wrap this walk would have started a whole-document pass per landing.
    ///
    /// WHERE it is called from is load-bearing, and not for the reason the re-entrancy guard above
    /// might suggest. `landed` runs in the settling Task's continuation, OUTSIDE `settleIfOwed`, so
    /// `isDecidingSettle` is not holding anything here: `rect(ofRow:)` tiles, the tile resizes the
    /// table, `FeedTableView.setFrameSize` reports it, and `settleIfOwed` re-enters freely. What
    /// stops it recurring is that `geometry.settle` and `show` have ALREADY run by this line, so
    /// the nested decision reads `.settled`, reaches `adoptSettled`, finds `shown` is that
    /// document's own rows, and returns. Move this call above those two and it becomes a loop.
    ///
    /// `adoptSettled` calls it too, and there the re-entrancy really is held by `isDecidingSettle`:
    /// that path runs inside `settleIfOwed`.
    private func converge(_ table: FeedTableView) {
        let rows = table.numberOfRows
        walkedRows(rows)
        for index in 0 ..< rows {
            _ = table.rect(ofRow: index)
        }
    }

    /// The document view given the height the walk above has just made true, rather than left to
    /// AppKit to arrive at in its own time (#1132).
    ///
    /// The walk converges the ROW RECTS; it does not move the table's own frame. That frame catches
    /// up on the next tile, and WHEN the tile happens is AppKit's business — measured here, it was
    /// still 456pt over a 41 759pt document at the end of `adoptSettled` and correct by the time
    /// the caller's `apply` had returned, with no code of ours in between. `landed` never had to
    /// care because it lays the scroll view out a line later; the adopt path lays nothing out, so
    /// on the CI runner the tile had not happened by the time anything asked and the table stood
    /// 8 570pt short of its own document — a fifth of the reading, all of it below everything the
    /// overview lane maps. Green on one machine and red on another is the shape of a fact nobody
    /// owns, so this path takes ownership of it.
    ///
    /// AFTER the walk, and that order is the whole of why this is not the frame-setting ADR-0030
    /// records as not working. Set BEFORE it, the height is taken straight back by the next tile,
    /// because that tile sums row rects still standing at the placeholder — measured, the same
    /// 8 662pt gap as setting nothing at all. Set after it, the tile sums rects that agree with the
    /// document and arrives at this very number, so the set is the document's own height brought
    /// forward rather than a value AppKit will disagree with.
    private func adopt(_ height: CGFloat, on table: FeedTableView) {
        table.setFrameSize(NSSize(width: table.frame.width, height: height))
    }

    /// Whether the held document is one there is still anything to give up: a pass that has landed
    /// already put its own document on screen.
    ///
    /// The DECISION the clock above reaches, split out so a case can reach it without one —
    /// `FeedVacancy.words(overdue:)` is split the same way, for the same reason.
    var surrendersHeld: Bool {
        settlingFor != nil
    }

    /// The hold given up — what `holdDocument()`'s clock does when it runs out.
    func surrenderHeld() {
        holding = nil
        guard surrendersHeld else { return }
        surrenderDocument()
    }

    /// The hold retired, because the pass it covers for has landed or been called off. Cleared
    /// HERE and not inside the task, because a `Task` property is assigned once and never cleared.
    private func releaseHold() {
        holding?.cancel()
        holding = nil
    }

    /// The rows the table draws now, and the cheapest true way to get from the ones it drew.
    private func show(
        _ rows: [FeedRow],
        against stale: [FeedRow],
        freshly: Bool,
        on table: NSTableView,
    ) {
        shown = rows
        handle?.drawing(!rows.isEmpty)
        guard !freshly, !stale.isEmpty else {
            // The reading OPENS here: a landing whose table had no rows before it is the first
            // pass a deck ever draws, so the policy is given the rows now rather than assumed to
            // have them already. Without it the reading opens at the top of a feed that opens at
            // its tail (ADR-0029), and the follow latch names a row in a reading of no rows.
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
