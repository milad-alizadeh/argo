import Observation

/// Which Session the shell has DRAWN, beside the one the roster is pointed at.
///
/// The click's own pass is the whole of what sits between the mouse-down and the frame that paints
/// the selected ground, so it may do no work that the selection is not itself. Taking the reading
/// there put a walk of the whole event stream, a plan projection and a header walk in front of that
/// frame, and a reader clicking a roster row watched the ground arrive after all of it. So a pass
/// on which this and `navigation.session` disagree takes NO reading: it paints the ground, commits,
/// and `catchUp(to:in:)` reads in a turn of its own (ADR-0028 Rule 1).
///
/// Only a SWITCH is deferred. Once the two agree, every later pass reads inline — which is what
/// keeps a Session whose transcript is growing under the reader drawing its own appends rather than
/// blinking through `FeedVacancy.unread` on every one of them.
///
/// What the deck loses for that turn is everything it derives from the reading: its rows, the
/// canopy's Session name, and the Subagents rail, which is read off the rows. All three come back
/// with the reading, and carrying any of them across would attribute the last Session's facts to
/// the row just clicked. What must NOT be lost is the measured heights — see
/// `FeedTableCoordinator.apply`, where an empty reading is refused the meaning "shrank to nothing".
///
/// A reference type held as `@State`, because the catch-up lands from a task rather than from the
/// event that started it, and a struct captured into one would write to a copy.
@MainActor
@Observable
final class DrawnSession {
    private(set) var session: CockpitPresentation.Session.ID?

    /// Whether anything has been drawn at all. `nil` is a Session the shell can be pointed at, so
    /// the first pass cannot be told from a switch onto nothing by the id alone — and the two want
    /// opposite answers. A first pass has no frame to protect and nothing on screen to keep
    /// responsive, so it reads INLINE and the window opens on a reading rather than on a blank.
    ///
    /// It leaves `false` on the change that repoints an empty selection at the first row
    /// (`CockpitNavigationModel.reconcile`), which is the launch, and stays `false` for a window
    /// that is never pointed at anything — where inline and deferred are the same nothing.
    private var hasDrawn = false

    /// Whether the shell has caught up with the row that was clicked.
    func isDrawn(_ pointed: CockpitPresentation.Session.ID?) -> Bool {
        !hasDrawn || session == pointed
    }

    /// Catches up with the pointed Session, in a turn of its OWN.
    ///
    /// A `Task` rather than a write here: this runs inside the very update the click invalidated,
    /// so writing now would put the reading back on the pass it was taken off. The continuation is
    /// enqueued on the main actor and runs on a LATER turn of it, which is the whole mechanism.
    /// A turn, not a frame: nothing here is a guarantee about a `CATransaction` boundary, only
    /// that the update the click started finishes before this runs.
    ///
    /// Late rather than never, and a main actor with a queue in front of it makes it later. That
    /// wait is exactly what `FeedVacancy.unread` reports, so the slow case says so on screen
    /// instead of going quiet.
    ///
    /// Re-read from the navigation rather than trusted from the argument: two clicks in a row
    /// enqueue two of these, and the first must not draw a row the reader has already left.
    func catchUp(
        to pointed: CockpitPresentation.Session.ID?,
        in navigation: CockpitNavigationModel,
    ) {
        Task {
            guard navigation.session == pointed else { return }
            session = pointed
            hasDrawn = true
        }
    }
}
