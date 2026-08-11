import SwiftUI

/// What the deck currently has open and where the keyboard is, in one value.
///
/// They are carried together because a row takes them together: every kind of row can open
/// something, and threading them as separate bindings put a fourth parameter on the row view for
/// no gain — a row does not care that one of them resizes a column, one covers it, and one decides
/// what Escape means.
struct FeedRowSelection {
    @Binding var open: FeedRow.ID?
    /// Which result inside the open row the reader asked for, where they asked for one — the
    /// position of a step down the panel. Beside `open` rather than inside it because the two are
    /// answered by different clicks: the row opens the panel, and a name listed under the row says
    /// where in it to be.
    @Binding var step: Int?
    @Binding var lit: FeedShot?
    /// Where the keyboard is. A `FocusState` binding rather than an ordinary one: focus is the
    /// system's to move, and a plain copy of it goes stale the moment a click lands somewhere else.
    var focus: FocusState<FeedFocus?>.Binding
    /// The way the keyboard comes back to a row. The rows live inside the table's cells now, so
    /// a `FocusState` value naming one resolves to nothing — the feed installs the table's own
    /// hand-back here, and the default keeps the focus write for a surface that never did.
    var homeward: ((FeedRow.ID) -> Void)?

    /// Open a row's evidence and go there. Focus follows the panel because the reader ASKED for
    /// it: a panel that opens beside an unmoved cursor is a pane a keyboard reader has to go and
    /// find, and the way back is `close()`.
    func openEvidence(of row: FeedRow.ID) {
        open = row
        step = nil
        focus.wrappedValue = .panel
    }

    /// Open a row's evidence AT one of its results — what a name listed under a folded run does.
    ///
    /// The panel is left where it is if it is already open on this row: reopening it would re-seed
    /// the reading and hand the keyboard over a second time, when what the reader asked for was to
    /// be further down a pane they are already looking at.
    func openEvidence(of row: FeedRow.ID, at result: Int) {
        if open != row {
            openEvidence(of: row)
        }
        step = result
    }

    /// Close the panel and hand the keyboard back to the row that opened it.
    ///
    /// The row is derived from what is open rather than remembered, which is what keeps the return
    /// honest: there is exactly one row the panel could have come from, and it is the one the
    /// panel is showing.
    func close() {
        if let open {
            hand(back: open)
        }
        open = nil
        step = nil
    }

    /// Open a picture full size and go there. Same bargain as the panel's, and for a stronger
    /// reason: the lightbox covers every zone at once, so a reader whose focus stayed behind is
    /// tabbing through a deck they cannot see.
    func light(_ shot: FeedShot) {
        lit = shot
        focus.wrappedValue = .lightbox
    }

    /// Close the lightbox and hand the keyboard back to the gallery the picture was in.
    ///
    /// Derived from the feed, not remembered: the shot knows its own address and the gallery row
    /// holding it is the one that offered the click. A picture no row in the CURRENT feed carries
    /// leaves focus alone rather than putting it somewhere arbitrary — a live transcript can grow
    /// under an open lightbox.
    func darken(returningInto feed: [FeedRow]) {
        if let shot = lit, let row = feed.first(where: { $0.shows(shot) }) {
            hand(back: row.id)
        }
        lit = nil
    }

    private func hand(back row: FeedRow.ID) {
        if let homeward {
            homeward(row)
        } else {
            focus.wrappedValue = .row(row)
        }
    }
}

extension FeedRow {
    /// Whether this row is the gallery a given picture was opened from.
    func shows(_ shot: FeedShot) -> Bool {
        guard case let .gallery(gallery) = content else { return false }
        return gallery.shots.contains(shot)
    }
}
