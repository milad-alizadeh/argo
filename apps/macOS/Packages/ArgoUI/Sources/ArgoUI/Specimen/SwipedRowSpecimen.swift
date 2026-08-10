import SwiftUI

/// A roster with one row swiped open, over the sidebar list it ships inside.
///
/// The one state in this feature no value test can see: whether an icon-only control revealed
/// behind a row reads as Archive with no word on it, whether it is a target worth aiming at in a
/// column this narrow, and whether the row sliding over the rows beside it still reads as one
/// list. The rows around it are at rest deliberately — only one is ever open (#514, story 13),
/// and a screenshot of a single open row could not show that.
struct SwipedRowSpecimen: View {
    /// The second row, not the first: an open row with neighbours on both sides is the one that
    /// says what the gesture costs the list around it.
    @State private var swipe = RosterSwipe(openRowID: SessionRosterProjection.previewRows[1].id)

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
