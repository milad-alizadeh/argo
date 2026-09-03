import SwiftUI

/// The reading's one scroll authority — the reading and the overview lane beside it hold the same
/// one, so the two surfaces cannot come to disagree about where it is or whether it is following.
///
/// It owns `FeedScrollPolicy`, which is where every landing rule lives, and the imperative verbs
/// the SwiftUI half still has over the table. The verbs are the shape of `ScrollViewProxy`, for the
/// same reason: a scroll is an act, not a state, and modelling one as state means inventing a token
/// that changes whenever the act should happen.
@MainActor @Observable package final class FeedTableHandle {
    /// The table this handle drives. Replaced wholesale when the rail scopes the feed onto a
    /// Subagent: `FeedColumn` is keyed to that scope, so the table, its scroll view and its
    /// coordinator are all built again under this one handle. That swap is the reading changing,
    /// and both things below are what it means.
    @ObservationIgnored weak var coordinator: FeedTableCoordinator? {
        didSet {
            guard let coordinator, coordinator !== oldValue else { return }
            // NOT `oldValue != nil`: a weak reference zeroed by the old table's deinit does not run
            // this observer at all, so whether one stood is a fact the handle has to keep itself.
            // Owed rather than done here, because the fresh reading's own `held` is not known until
            // it is applied — see `reopenIfOwed(held:)`.
            owesReopen = hasTable
            hasTable = true
            tableChanged?()
        }
    }

    /// The overview lane re-attaching, because nothing else tells it: the lane's notifications are
    /// registered on the views the swap discarded, and the deck update that starts the swap runs
    /// before the replacement exists. One slot, for the one lane the deck puts beside a feed.
    @ObservationIgnored var tableChanged: (() -> Void)?

    /// Whether a table has ever stood under this handle — see `coordinator`.
    @ObservationIgnored private var hasTable = false
    /// Whether the reading under this handle was replaced and the policy has yet to be started
    /// over for it.
    @ObservationIgnored private var owesReopen = false

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

    /// Another reading opened in the SAME table — a Session switch, or the rail scoping onto a
    /// Subagent. Set by the overview lane as it attaches, beside `readingReshaped`.
    ///
    /// A separate announcement because the reshape is not one: a replaced reading is reported to
    /// the lane through the table's own `setFrameSize`, and the lane answers that by asking whether
    /// the document's HEIGHT moved. Two readings that differ in every row can stand at the same
    /// height — both shorter than the pane is the ordinary case — and the lane then goes on drawing
    /// the map of the reading that left. `MinimapReadingStamp` says why a height cannot stand for a
    /// document; this is the fact it cannot see.
    @ObservationIgnored var readingReplaced: (() -> Void)?

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

    /// The policy started over for a reading that replaced the last one, because every rule in it
    /// is about the rows it was resolving against. Carried across a swap, the follow latch says the
    /// reader left an end they never reached, `leftAt` counts new messages from a row this reading
    /// does not have, and the opening it already made parks the fresh feed wherever the last one
    /// was being read.
    ///
    /// Asked by the table applying its FIRST model, which is where the reading it opens held at is
    /// known — the swap itself carries no rows yet, and `FeedRow.ID` is a dense position, so the
    /// row the last reading was held at names a different line in this one.
    func reopenIfOwed(held: FeedRow.ID?) {
        guard owesReopen else { return }
        owesReopen = false
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
