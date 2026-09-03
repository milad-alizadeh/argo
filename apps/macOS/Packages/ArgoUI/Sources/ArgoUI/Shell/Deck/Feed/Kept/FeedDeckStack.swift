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

    func show(_ deck: KeptDeck) {
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
        for held in kept {
            held.scroller.isHidden = held !== deck
        }
        shown = deck.scroller
        layoutShown()
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
