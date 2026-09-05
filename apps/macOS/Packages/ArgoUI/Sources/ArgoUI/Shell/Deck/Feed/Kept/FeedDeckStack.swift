import AppKit

/// The one view the feed zone puts on screen, with every kept deck's scroller inside it and exactly
/// one of them shown (ADR-0030, Rule 4).
///
/// A hide and a show, never a reload: the deck the reader leaves keeps its rows realised, its
/// document standing and its offset where they left it, and the deck they come back to is the one
/// that was already there.
///
/// Only the shown deck tracks this view's size. A hidden one keeps the frame it was left at, so a
/// window resized while it is away costs it nothing until it is shown again — which is where the
/// one re-wrap it owes is taken (ADR-0030, Rule 6).
///
/// It keeps its own list of what it has put on screen rather than taking the store's. A deck is
/// evicted during a SwiftUI pass and this is an AppKit view: the retired deck leaves the tree here,
/// on the update, rather than out of the body that decided it.
final class FeedDeckStack: NSView {
    private var kept: [KeptDeck] = []
    /// The deck on screen. Weak, because `KeptDecks` owns every deck.
    private weak var shown: NSScrollView?

    /// How many times this stack has written a scroller's visibility. Not a statistic: a write to
    /// `isHidden` is the one thing here AppKit answers with work of its own, so the count is how a
    /// suite asks whether a pass said anything at all (#1260). Not DEBUG-only, for the same reason
    /// `FeedTableView`'s layout count is not: it is one increment beside work that costs orders
    /// more.
    private(set) var visibilityWrites = 0

    /// Whether a hide is already queued for the next turn, so a stack updated many times before
    /// that
    /// turn arrives queues one sweep rather than one per pass.
    private var isSweepQueued = false

    func show(_ deck: KeptDeck) {
        // A different deck coming forward is a SELECTION and never a key, so whatever keyboard
        // cursor this one was left with is not one the reader is asking for now (#1180). `show`
        // runs every pass, so the comparison is what tells a switch from a re-render.
        if deck.scroller !== shown {
            deck.coordinator.forgetCursor()
        }
        if !kept.contains(where: { $0 === deck }) {
            kept.append(deck)
            deck.scroller.autoresizingMask = []
            addSubview(deck.scroller)
        }
        kept.removeAll { held in
            guard held.isRetired else { return false }
            held.scroller.removeFromSuperview()
            return true
        }
        reveal(deck.scroller)
        shown = deck.scroller
        layoutShown()
        queueSweep()
    }

    /// The deck the reader chose, in the pass that chose it: unhidden, and last in `subviews`,
    /// which
    /// is topmost. Both halves matter, because the deck going away is still on screen until the
    /// next
    /// turn — covered by this one rather than racing it, so what the reader sees is the deck they
    /// asked for and never a frame of the one they left.
    ///
    /// Revealing is safe to do here. Hiding is not, which is what `queueSweep` is for.
    private func reveal(_ scroller: NSScrollView) {
        if scroller.isHidden {
            scroller.isHidden = false
            visibilityWrites += 1
        }
        if subviews.last !== scroller {
            // Re-adding a subview already held moves it to the end rather than rebuilding it, so
            // the
            // deck keeps the rows, document and offset Rule 4 kept it for.
            addSubview(scroller)
        }
    }

    /// Every deck but the shown one, hidden — ON THE NEXT TURN, never in the pass that asked.
    ///
    /// `show(_:)` is called from `updateNSView`, inside SwiftUI's own update of the view graph, and
    /// AppKit answers hiding a view by walking the window's key view loop. That walk asks every
    /// `NSHostingView` under it for its responder node, which re-enters the graph the pass is an
    /// update of: SwiftUI calls the re-entry an AttributeGraph cycle and AppKit skips the layout
    /// pass, and a skipped pass can leave a row at the wrong height with nothing in the pixels to
    /// say why (#1260). A turn later the update is over, the same walk finds nothing to re-enter,
    /// and the deck going away was covered the whole time, so none of the delay is on screen.
    private func queueSweep() {
        guard !isSweepQueued else { return }
        isSweepQueued = true
        Task { @MainActor [weak self] in
            self?.sweep()
        }
    }

    private func sweep() {
        isSweepQueued = false
        for held in kept where held.scroller !== shown && !held.scroller.isHidden {
            held.scroller.isHidden = true
            visibilityWrites += 1
        }
    }

    override func layout() {
        super.layout()
        layoutShown()
    }

    /// The shown deck at this view's size — and nothing said to the hidden ones, which is what
    /// keeps a resize from re-wrapping five documents nobody is looking at.
    private func layoutShown() {
        guard let shown, shown.frame != bounds else { return }
        shown.frame = bounds
    }
}
