import AppKit

/// The one view the feed zone puts on screen, with every kept deck's scroller inside it and exactly
/// one of them drawn (ADR-0030, Rule 4).
///
/// A hide and a show, never a reload: the deck the reader leaves keeps its rows realised, its
/// document standing and its offset where they left it, and the deck they come back to is the one
/// that was already there.
///
/// Drawn and hidden are two different moments here, and `sweep()` is where that is explained: the
/// deck going away stops being drawn in the pass that switched and is hidden a turn later.
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

    /// How many times this stack has written a scroller's `isHidden`. Not a statistic: hiding is
    /// the
    /// one thing here AppKit can answer with a walk of the window's key view loop, so the count is
    /// how a suite asks whether a pass took that risk (#1260). Not DEBUG-only, for the same reason
    /// `FeedTableView`'s layout count is not: it is one increment beside work that costs orders
    /// more.
    private(set) var visibilityWrites = 0

    /// Whether a hide is already queued, so a stack updated many times before that turn arrives
    /// queues one sweep rather than one per pass.
    private var isSweepQueued = false

    func show(_ deck: KeptDeck) {
        // A different deck coming forward is a SELECTION and never a key, so whatever keyboard
        // cursor this one was left with is not one the reader is asking for now (#1180). `show`
        // runs every pass, so the comparison is what tells a switch from a re-render.
        let isSwitch = deck.scroller !== shown
        if isSwitch {
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
        guard isSwitch else { return }
        reveal(deck.scroller)
        shown = deck.scroller
        layoutShown()
        queueSweep()
    }

    /// The switch, in the pass that asked for it: the deck coming forward drawn and on top, every
    /// other one drawn no more.
    ///
    /// `alphaValue` and not `isHidden`, and that is the whole of #1260. `show(_:)` is called from
    /// `updateNSView`, inside SwiftUI's own update of the view graph, and hiding a view that holds
    /// the window's first responder makes AppKit walk the key view loop looking for the next one —
    /// which asks every `NSHostingView` under it for its responder node, and that re-enters the
    /// graph the pass is an update of. SwiftUI calls the re-entry an AttributeGraph cycle and
    /// AppKit
    /// skips the layout pass, and a skipped pass can leave a row at the wrong height with nothing
    /// in
    /// the pixels to say why. Measured on this machine, hiding such a view walks the loop and
    /// `alphaValue`, unhiding and reordering all walk nothing.
    ///
    /// Alpha rather than z-order because a deck scroller draws no background of its own
    /// (`FeedTableCoordinator+Make`), so two of them at the same frame composite and the reader
    /// would see one transcript through the other. The reorder is still taken, so that for the turn
    /// the deck going away is still in the tree it is not the view a click lands in.
    private func reveal(_ scroller: NSScrollView) {
        for held in kept where held.scroller !== scroller {
            held.scroller.alphaValue = 0
        }
        scroller.alphaValue = 1
        if scroller.isHidden {
            scroller.isHidden = false
            visibilityWrites += 1
        }
        // `positioned:` and not the plain `addSubview`, which broadcasts a window move through the
        // whole subtree — every realised row's hosting view, inside the update.
        if subviews.last !== scroller {
            addSubview(scroller, positioned: .above, relativeTo: nil)
        }
    }

    /// Every deck but the shown one, hidden — a turn after the pass that asked, never inside it.
    ///
    /// Hiding is what `reveal` cannot do, for the reason spelled out there. A turn later the update
    /// is over, so the same walk finds nothing to re-enter, and the deck has been drawing nothing
    /// since the switch, so none of the delay is on screen. Hidden is still worth arriving at: an
    /// alpha of zero leaves the deck in the key view loop and in the layout its window does.
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
            // Back to opaque behind the flag, so the deck comes back in one write and not two.
            held.scroller.alphaValue = 1
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
