import SwiftUI

/// The rename dialog in a REAL popover, opened on appear over the roster it belongs to.
///
/// `RenameDialogSpecimen` draws the content directly, which renders it but never puts it in the
/// context it actually lives in — and a popover is its own window with its own environment, which
/// is exactly where a panel that renders fine outside one comes apart (`OpenDrawerSpecimen`). No
/// package test can click, so this case is how that context is reachable at all.
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

#Preview("Rename dialog — in the popover it actually opens in") {
    OpenRenameDialogSpecimen()
        .frame(height: 420)
        .argoAppearance()
}
