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
    @ObservationIgnored weak var coordinator: FeedTableCoordinator? {
        didSet {
            guard coordinator !== oldValue else { return }
            // A table BUILT under this handle is the first reading; one that replaced another is a
            // different reading, and the policy is a fact about the reading it was answering.
            if oldValue != nil {
                reopen()
            }
            tableChanged?()
        }
    }

    /// What the overview lane does when the table under this handle is REPLACED — a rail chip
    /// scoping the feed onto a Subagent tears the reading down and builds another (`FeedColumn` is
    /// keyed to the scope). Nothing else says so: the lane's notifications are registered on the
    /// views the switch discarded, and the deck's own update runs before the replacement exists, so
    /// the lane would go on mapping a reading nobody is reading.
    @ObservationIgnored var tableChanged: (() -> Void)?

    @ObservationIgnored private var policy: FeedScrollPolicy
    /// The row the reading opens held at, kept so a reading that replaces this one opens the way
    /// the first did.
    @ObservationIgnored private let held: FeedRow.ID?

    /// Whether the reading is still following the Session.
    private(set) var isFollowing: Bool
    /// The last row present when following broke — what `FeedTail.newMessages` counts from.
    private(set) var leftAt: FeedRow.ID?

    /// Seeded with the row the reading opens held at, so both facts are already true before the
    /// first frame — which is what lets a still show the detached state without anybody scrolling.
    init(held: FeedRow.ID? = nil) {
        self.held = held
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

    /// A fresh reading under the same handle — every rule in the policy is about the rows it was
    /// resolving against, and a rail chip replaces all of them. Carried across, the follow latch
    /// says the reader left an end they never reached, `leftAt` counts new messages from a row that
    /// is not in this reading, and the opening it already made parks the Subagent's feed wherever
    /// the Session's was being read.
    private func reopen() {
        policy = FeedScrollPolicy(held: held)
        publish()
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
