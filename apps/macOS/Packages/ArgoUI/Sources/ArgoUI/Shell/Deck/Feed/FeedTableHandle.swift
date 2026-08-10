import SwiftUI

/// The imperative verbs the SwiftUI half still owns — the way-back control's scroll, and the
/// deck handing the keyboard back to a row. The same shape as `ScrollViewProxy`, for the same
/// reason: a scroll is an act, not a state, and modelling it as state means inventing a token
/// that changes whenever the act should happen.
@MainActor final class FeedTableHandle {
    weak var coordinator: FeedTableCoordinator?

    /// Back to the end of the reading. `nil` pace lands instantly.
    func follow(over pace: TimeInterval?) {
        coordinator?.scrollToEnd(over: pace)
    }

    /// The keyboard onto a row — the deck's half of `FeedRowSelection.close()`.
    func focus(onto id: FeedRow.ID) {
        coordinator?.focus(onto: id)
    }
}
