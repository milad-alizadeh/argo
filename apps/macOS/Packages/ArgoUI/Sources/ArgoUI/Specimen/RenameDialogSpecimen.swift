import SwiftUI

/// The rename panel's content, stood in a glass of its own — the same stand-in `DrawerSpecimen`
/// makes, because a popover is a window of its own and never lands in a screenshot of this one.
///
/// Both states in one frame: the panel of a Session already renamed, with the title it covered up
/// under the field, and the panel of one nobody has touched. The judgement the PNG exists for is
/// whether the second reads as complete rather than as the first with a control missing — and
/// whether a derived title under a field reads as somewhere to go BACK to rather than as a second
/// thing to type in.
struct RenameDialogSpecimen: View {
    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.region) {
            panel(RenameDialogFixture.renamed)
            panel(RenameDialogFixture.untouched)
        }
        .padding(ArgoSpacing.region)
    }

    private func panel(_ rename: SessionRenameProjection.Rename) -> some View {
        RenameSessionDialog(rename: rename, commit: { _ in }, cancel: {})
            .glassEffect(in: .rect(cornerRadius: ArgoRadius.popover))
    }
}

/// The same dialog in a REAL popover, hung off the row it is opened from.
///
/// `RenameDialogSpecimen` draws the content directly, which renders it but never puts it in the
/// context it actually lives in — and a popover is its own window with its own environment, which
/// is exactly where a panel that renders fine outside one comes apart (`OpenDrawerSpecimen`). No
/// package test can click, so this case is how that is reachable at all.
struct OpenRenameDialogSpecimen: View {
    @State private var isOpen = false

    var body: some View {
        RenamedRosterSpecimen()
            .onAppear { isOpen = true }
            .popover(isPresented: $isOpen, arrowEdge: .trailing) {
                RenameSessionDialog(
                    rename: RenameDialogFixture.renamed,
                    commit: { _ in },
                    cancel: { isOpen = false },
                )
            }
    }
}

/// The roster with one row carrying a name somebody typed. The claim is story 19's, drawn: the
/// renamed row reads as the Session's name rather than as a label pinned over a title, and the
/// rows either side of it still show the ones their transcripts derived.
struct RenamedRosterSpecimen: View {
    var body: some View {
        List {
            ForEach(RenameDialogFixture.rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }
}

#Preview("Rename dialog — renamed and untouched, side by side") {
    RenameDialogSpecimen()
        .frame(height: 340)
        .argoAppearance()
}

#Preview("Renamed roster — one name somebody typed, two derived") {
    RenamedRosterSpecimen()
        .frame(height: 240)
        .argoAppearance()
}
