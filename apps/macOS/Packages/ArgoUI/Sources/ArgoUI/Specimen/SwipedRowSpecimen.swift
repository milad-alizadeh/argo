import SwiftUI

/// A roster with one row pulled left, over the sidebar list it ships inside.
///
/// The one state in this feature no value test can see: whether an icon-only control revealed
/// behind a row reads as Archive with no word on it, whether it is a target worth aiming at in a
/// column this narrow, and whether the row sliding over the rows beside it still reads as one
/// list. The rows around it are at rest deliberately — only one is ever open (#514, story 13),
/// and a picture of a single open row could not show that.
struct SwipedRowSpecimen: View {
    /// How far the row has been pulled. Both are drawn states rather than one, because the
    /// distance between them IS the two gestures: `settled` is what waits for a click, `hard` is
    /// what acts on release, and they have to be told apart at a glance while pulling.
    enum Pull {
        case settled
        case hard
    }

    @State private var swipe: RosterSwipe

    init(pull: Pull = .settled) {
        // The second row, not the first: an open row with neighbours on both sides is the one
        // that says what the gesture costs the list around it.
        let rowID = SessionRosterProjection.previewRows[1].id
        var swipe = RosterSwipe()
        switch pull {
        case .settled:
            swipe = RosterSwipe(openRowID: rowID)
        case .hard:
            swipe.drag(rowID, translation: -ArgoLayout.rosterSwipeCommit)
        }
        _swipe = State(initialValue: swipe)
    }

    var body: some View {
        List {
            ForEach(SessionRosterProjection.previewRows) { row in
                ArchiveSwipeRow(row: row, swipe: $swipe, archive: {}).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }
}

#Preview("Swiped row — the Archive revealed behind one row of five") {
    SwipedRowSpecimen()
        .frame(height: 340)
        .argoAppearance()
}

#Preview("Swiped row — pulled far enough to archive on release") {
    SwipedRowSpecimen(pull: .hard)
        .frame(height: 340)
        .argoAppearance()
}
