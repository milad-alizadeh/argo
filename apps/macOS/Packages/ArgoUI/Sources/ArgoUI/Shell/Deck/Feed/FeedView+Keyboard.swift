import SwiftUI

// Where the keyboard is in the reading — the second of the two whole-reading behaviours `FeedView`
// carries, split off from the first. It touches none of the view's scroll state: a move is a
// function of the rows, the focus the deck owns, and the scroller it is handed, which is why it can
// sit beside the view rather than inside it.

extension FeedView {
    /// One row up or down, with the row it lands on scrolled into view.
    ///
    /// The scroll is not optional: focus moving to a row below the fold moves it off screen, and a
    /// keyboard reader whose cursor left the screen has lost the feed. Left and right belong to
    /// whatever the row draws, so they fall through.
    func move(_ direction: MoveCommandDirection, with scroller: ScrollViewProxy) {
        guard case let .row(current) = selection.focus.wrappedValue,
              let standing = rows.firstIndex(where: { $0.id == current })
        else { return }
        let next = switch direction {
        case .up: standing - 1
        case .down: standing + 1
        case .left, .right: standing
        @unknown default: standing
        }
        guard rows.indices.contains(next), next != standing else { return }
        selection.focus.wrappedValue = .row(rows[next].id)
        scroller.scrollTo(rows[next].id)
    }
}
