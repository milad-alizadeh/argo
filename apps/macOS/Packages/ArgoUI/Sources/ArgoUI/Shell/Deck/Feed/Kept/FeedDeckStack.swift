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
final class FeedDeckStack: NSView {
    /// The deck on screen. Weak, because `KeptDecks` owns every deck and may evict this one.
    private weak var shown: NSScrollView?

    /// `kept` in the store's own order, `deck` the one the reader is reading.
    func show(_ deck: KeptDeck, of kept: [KeptDeck]) {
        let scrollers = kept.map(\.scroller)
        for view in subviews where !scrollers.contains(where: { $0 === view }) {
            view.removeFromSuperview()
        }
        for scroller in scrollers where scroller.superview !== self {
            scroller.autoresizingMask = []
            addSubview(scroller)
        }
        for scroller in scrollers {
            scroller.isHidden = scroller !== deck.scroller
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
