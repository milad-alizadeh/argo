import SwiftUI

/// The reading's one scroll authority — the reading and the overview lane beside it hold the same
/// one, so the two surfaces cannot come to disagree about where it is or whether it is following.
///
/// It owns `FeedScrollPolicy`, which is where every landing rule lives, and the imperative verbs
/// the SwiftUI half still has over the table. The verbs are the shape of `ScrollViewProxy`, for the
/// same reason: a scroll is an act, not a state, and modelling one as state means inventing a token
/// that changes whenever the act should happen.
@MainActor @Observable package final class FeedTableHandle {
    /// The table this handle drives — its deck's own, set once when the deck is made and never
    /// re-pointed (`KeptDeck`). A handle belongs to one reading for its life.
    @ObservationIgnored weak var coordinator: FeedTableCoordinator? {
        didSet {
            guard let coordinator, coordinator !== oldValue else { return }
            tableChanged?()
        }
    }

    /// The overview lane hearing that a table now stands under this handle. The lane attaches
    /// before the deck has built its scroller in the ordinary mount, and nothing else tells it.
    @ObservationIgnored var tableChanged: (() -> Void)?

    @ObservationIgnored private var policy: FeedScrollPolicy

    /// Whether the reading is still following the Session.
    private(set) var isFollowing: Bool

    /// Whether a settled document stands under this table — whether the deck may draw the reading
    /// at all (ADR-0030, Rule 3).
    ///
    /// Observable, because it is the one fact the SwiftUI half of the deck renders off: the feed
    /// and the overview lane appear in the frame this turns true, and the provisional word stands
    /// in the frames before it. Written by the coordinator, which is where a pass lands.
    private(set) var isSettled = false
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
    package init(held: FeedRow.ID? = nil) {
        let policy = FeedScrollPolicy(held: held)
        self.policy = policy
        self.isFollowing = policy.isFollowing
        self.leftAt = policy.leftAt
    }

    /// Whether the opening scroll is still owed — see `FeedScrollPolicy`. Read by the adapter and
    /// not observable, because it is taken off the policy directly rather than mirrored.
    package var isOpeningOwed: Bool {
        policy.isOpeningOwed
    }

    /// A settled document landed under this table, or the one that stood was surrendered.
    func settled(_ isSettled: Bool) {
        guard self.isSettled != isSettled else { return }
        self.isSettled = isSettled
    }

    /// Whether the table has a reading ON SCREEN — rows realised, at heights it measured.
    ///
    /// The deck's provisional word is drawn off this rather than off the rows the shell handed
    /// down, and the two are not the same question now that a deck is kept: the shell hands the
    /// deck it is coming back to an empty feed for the pass that paints the click (`DrawnSession`),
    /// and that deck is already drawing the reading those rows are on their way back to.
    private(set) var isDrawing = false

    /// How many rows the table draws, reported where that changes (`FeedTableCoordinator.show`).
    func drawing(_ rows: Int) {
        guard isDrawing != (rows > 0) else { return }
        isDrawing = rows > 0
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
    package func focus(onto id: FeedRow.ID) {
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
