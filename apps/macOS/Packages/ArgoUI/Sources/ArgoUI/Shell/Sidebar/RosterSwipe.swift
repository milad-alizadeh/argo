import CoreGraphics

/// Which roster row is swiped open, how far it is drawn from its resting place, and what
/// releasing the gesture means.
///
/// A value rather than a view's `@State` scattered across a row, because every rule the gesture
/// has is a DECISION — how far is far enough to settle open, how far is far enough to archive
/// outright, and what happens to a row that was already open when a second one is pulled. A view
/// that decided those in a `DragGesture` closure would put them where no test can reach them, and
/// the last of them is the one that only exists between two rows: only one row is ever open
/// (#514, story 13), which no single row can enforce about itself.
struct RosterSwipe: Equatable {
    /// What releasing the gesture amounts to.
    enum Release: Equatable {
        /// Snapped back. The row was not pulled far enough to mean anything.
        case closed
        /// Settled open, with its control revealed and waiting to be clicked.
        case open
        /// Pulled hard enough to act on release, with no second click (story 12).
        case archive
    }

    /// The row currently sitting open, if any. At most one, by construction.
    private(set) var openRowID: String?
    /// The row under a live gesture and how far left it has been pulled, measured from its own
    /// resting place — which is the reveal for a row that was already open, and zero otherwise.
    private var draggingRowID: String?
    private var travel: CGFloat = 0

    init(openRowID: String? = nil) {
        self.openRowID = openRowID
    }

    /// How far left of its resting place a row is drawn. Negative, because the roster's rows
    /// travel one way: an Archive revealed on the leading edge would be a different gesture.
    func offset(of rowID: String) -> CGFloat {
        -travelled(rowID)
    }

    /// Whether the control behind this row is worth drawing at all. A row at rest draws none:
    /// clearing a Session costs one gesture and NO chrome at rest (story 11).
    func isRevealing(_ rowID: String) -> Bool {
        revealedWidth(of: rowID) > 0
    }

    /// How wide the control behind a row is drawn: the WHOLE distance the row has travelled,
    /// never a fixed slot. Pinned at the reveal it would leave bare sidebar between the row and
    /// the control for the entire approach to the hard swipe, which is most of that gesture.
    func revealedWidth(of rowID: String) -> CGFloat {
        travelled(rowID)
    }

    /// The gesture moving. `translation` is the drag's own x, so a pull left is negative and a
    /// push back right unwinds an open row towards closed.
    ///
    /// Dragging any row closes whatever else was open, at the moment the pull starts rather than
    /// when it ends: two rows half-open at once is the state story 13 exists to prevent, and a
    /// row left behind is only noticed once the reader has moved on.
    mutating func drag(_ rowID: String, translation: CGFloat) {
        draggingRowID = rowID
        if openRowID != rowID {
            openRowID = nil
        }
        travel = clamped(resting(rowID) - translation)
    }

    /// The gesture let go. The row settles at whichever of the three answers its travel earned,
    /// and the caller performs the archive — this type decides, it does not act.
    mutating func release(_ rowID: String) -> Release {
        let travelled = travelled(rowID)
        draggingRowID = nil
        travel = 0
        if travelled >= ArgoLayout.rosterSwipeCommit {
            openRowID = nil
            return .archive
        }
        if travelled >= ArgoLayout.rosterSwipeSettle {
            openRowID = rowID
            return .open
        }
        openRowID = nil
        return .closed
    }

    /// Everything shut. What clicking elsewhere means, and what a roster whose selection moved
    /// under the reader means: a half-swiped row is never left behind them (story 13).
    mutating func close() {
        openRowID = nil
        draggingRowID = nil
        travel = 0
    }

    /// A row's travel: the live gesture's while it is the one being dragged, and its resting
    /// place otherwise — so the row that is open stays open while a neighbour is pulled.
    private func travelled(_ rowID: String) -> CGFloat {
        draggingRowID == rowID ? travel : resting(rowID)
    }

    private func resting(_ rowID: String) -> CGFloat {
        openRowID == rowID ? ArgoLayout.rosterSwipeRevealWidth : 0
    }

    /// A row follows the finger only as far as the hard swipe: past the point where releasing
    /// archives, further travel says nothing, and a row that kept sliding would read as one that
    /// could be pulled clean off the roster.
    private func clamped(_ travel: CGFloat) -> CGFloat {
        min(max(travel, 0), ArgoLayout.rosterSwipeCommit)
    }
}
