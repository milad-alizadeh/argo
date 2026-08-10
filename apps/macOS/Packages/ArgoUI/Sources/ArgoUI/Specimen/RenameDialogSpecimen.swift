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

#Preview("Rename dialog — renamed and untouched, side by side") {
    RenameDialogSpecimen()
        .frame(height: 340)
        .argoAppearance()
}
