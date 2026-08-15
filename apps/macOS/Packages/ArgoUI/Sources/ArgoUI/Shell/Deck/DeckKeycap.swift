import SwiftUI

/// The key that answers, raised off the control it sits on: a hint ghosted to 60% reads as a
/// disabled label.
///
/// At the deck's own level because both its callers are — the Permission prompt's two answers in
/// the composer, and the ask row's `Answer` in the feed (#712). It began private inside
/// `PermissionPromptFooter`; the second caller is what promoted it.
struct DeckKeycap: View {
    @Environment(\.argo) private var argo

    let key: String

    var body: some View {
        Text(key)
            .argoText(ArgoTypography.machineCaption)
            .padding(.horizontal, ArgoSpacing.tight)
            .padding(.vertical, ArgoSpacing.hair)
            // `marked` is the one ground specified to keep its lift on whatever it lands on, here
            // an accent fill and a translucent pill.
            .background(argo.color.surface.marked, in: .rect(cornerRadius: ArgoRadius.marker))
    }
}
