import SwiftUI

/// What the deck currently has open and where the keyboard is, in one value.
struct FeedRowSelection {
    @Binding var open: FeedRow.ID?
    /// Which result inside the open row the reader asked for — the position of a step down the
    /// panel.
    @Binding var step: Int?
    @Binding var lit: FeedShot?
    /// Where the keyboard is. A `FocusState` binding rather than an ordinary one: focus is the
    /// system's to move, and a plain copy of it goes stale the moment a click lands somewhere else.
    var focus: FocusState<FeedFocus?>.Binding
    /// The way the keyboard comes back to a row. Rows live inside the table's cells, so a
    /// `FocusState` value naming one resolves to nothing — the feed installs the table's own
    /// hand-back here, and the default keeps the focus write for a surface that never did.
    var homeward: ((FeedRow.ID) -> Void)?

    /// Open a row's evidence and go there; the way back is `close()`.
    func openEvidence(of row: FeedRow.ID) {
        open = row
        step = nil
        focus.wrappedValue = .panel
    }

    /// Open a row's evidence AT one of its results — what a name listed under a folded run does.
    ///
    /// The panel is left where it is if it is already open on this row: reopening it would re-seed
    /// the reading and hand the keyboard over a second time.
    func openEvidence(of row: FeedRow.ID, at result: Int) {
        if open != row {
            openEvidence(of: row)
        }
        step = result
    }

    /// Close the panel and hand the keyboard back to the row that opened it, derived from what is
    /// open rather than remembered.
    func close() {
        if let open {
            hand(back: open)
        }
        open = nil
        step = nil
    }

    /// Open a picture full size and go there — the lightbox covers every zone at once, so a reader
    /// whose focus stayed behind is tabbing through a deck they cannot see.
    func light(_ shot: FeedShot) {
        lit = shot
        focus.wrappedValue = .lightbox
    }

    /// Close the lightbox and hand the keyboard back to the gallery the picture was in.
    ///
    /// A picture no row in the CURRENT feed carries leaves focus alone — a live transcript can
    /// grow under an open lightbox.
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
    /// Whether this row is where a picture came from. Two rows can be: a call's gallery, and the
    /// prompt somebody pasted one into (#733).
    func shows(_ shot: FeedShot) -> Bool {
        switch content {
        case let .gallery(gallery): gallery.shots.contains(shot)
        case let .prompt(_, shots): shots.contains(shot)
        default: false
        }
    }
}
