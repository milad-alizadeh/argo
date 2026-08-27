import SwiftUI

/// A hairline in one of the contract's edge inks, taking its orientation from the stack it sits in.
///
/// The `Divider` is HIDDEN and drawn over, not tinted: it keeps the platform's thickness and its
/// orientation, but a translucent ink over its own grey composites brighter than the role asks for.
struct ArgoRule: View {
    let ink: ArgoColor

    var body: some View {
        Divider()
            .hidden()
            .overlay(ink.color)
    }
}

#Preview("Rules — the two inks a surface parts things with") {
    @Previewable @Environment(\.argo) var argo

    VStack(spacing: ArgoSpacing.section) {
        ArgoRule(ink: argo.color.edge.hairline)
        ArgoRule(ink: argo.color.edge.subtle)
    }
    .frame(width: 220)
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}
