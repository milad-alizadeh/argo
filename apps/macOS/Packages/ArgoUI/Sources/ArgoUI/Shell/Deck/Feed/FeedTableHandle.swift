import SwiftUI

/// The reading's one scroll authority — the reading and the overview lane beside it hold the same
/// one, so the two surfaces cannot come to disagree about where it is or whether it is following.
///
/// It owns `FeedScrollPolicy`, which is where every landing rule lives, and the imperative verbs
/// the
/// SwiftUI half still has over the table. The verbs are the shape of `ScrollViewProxy`, for the
/// same
/// reason: a scroll is an act, not a state, and modelling one as state means inventing a token that
/// changes whenever the act should happen.
@MainActor @Observable final class FeedTableHandle {
    @ObservationIgnored weak var coordinator: FeedTableCoordinator?
    @ObservationIgnored private var policy: FeedScrollPolicy

    /// Whether the reading is still following the Session.
    private(set) var isFollowing: Bool
    /// The last row present when following broke — what `FeedTail.newMessages` counts from.
    private(set) var leftAt: FeedRow.ID?

    /// What the overview lane does when the reading changes SHAPE, set by the lane as it attaches.
    ///
    /// A callback out rather than a fact anything renders, so it is not observable. It is on the
    /// handle because the lane's reshape decision and the feed's own pane decision are two
    /// decisions about one kind of event, and #971 asked for them to be reached from one
    /// registration — see `FeedTableCoordinator.notedReshape()`.
    @ObservationIgnored var readingReshaped: (() -> Void)?

    /// Seeded with the row the reading opens held at, so both facts are already true before the
    /// first frame — which is what lets a still show the detached state without anybody scrolling.
    init(held: FeedRow.ID? = nil) {
        let policy = FeedScrollPolicy(held: held)
        self.policy = policy
        self.isFollowing = policy.isFollowing
        self.leftAt = policy.leftAt
    }

    /// Whether the opening scroll is still owed — see `FeedScrollPolicy`. Read by the adapter and
    /// not observable, because it is taken off the policy directly rather than mirrored.
    var isOpeningOwed: Bool {
        policy.isOpeningOwed
    }

    /// Another reading in the same table — see `FeedScrollPolicy.reopen(on:held:)`. Called by the
    /// coordinator rather than by a view, because the reset has to be true BEFORE the fresh rows
    /// are diffed and landed, and a SwiftUI `onChange` fires after that pass.
    func reopen(on rows: [FeedRow], held: FeedRow.ID?) {
        policy.reopen(on: rows, held: held)
        publish()
    }

    func resolve(_ event: FeedScrollEvent) -> FeedScrollDecision {
        let decision = policy.resolve(event)
        publish()
        return decision
    }

    /// Back to the newest row, because the reader asked. `nil` pace lands instantly.
    func follow(over pace: TimeInterval?) {
        coordinator?.execute(resolve(.followRequested), over: pace)
    }

    /// The keyboard onto a row — the deck's half of `FeedRowSelection.close()`.
    func focus(onto id: FeedRow.ID) {
        coordinator?.focus(onto: id)
    }

    /// The policy's two published facts, mirrored out only when they actually change. An
    /// `@Observable` stored property notifies on every write, and `resolve` runs once per frame of
    /// a live scroll — mirroring unconditionally would re-render the reading at scroll rate.
    private func publish() {
        if isFollowing != policy.isFollowing {
            isFollowing = policy.isFollowing
        }
        if leftAt != policy.leftAt {
            leftAt = policy.leftAt
        }
    }
}
