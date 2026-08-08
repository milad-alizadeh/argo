import SwiftUI

/// This Project, on this checkout — the two halves and the rule between them, as one control.
///
/// No glass of its own: the single toolbar item hosting it supplies that, and one capsule around
/// both is the whole claim. It tints the pair, so the merged vessel speaks in one colour.
struct ScopeVessel: View {
    @Environment(\.argo) private var argo

    let presentation: CockpitPresentation
    let actions: CockpitActions

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ProjectVessel(presentation: presentation, actions: actions)
            DeckSeparator()
                .frame(height: ArgoLayout.scopeDividerHeight)
                .accessibilityHidden(true)
            GitVessel(checkout: presentation.checkout, refresh: actions.refreshCheckout)
        }
        // The toolbar draws the glass but not the room inside it. Without this the folder mark sat
        // ~3.5pt off its own rim while the Rooms vessel next to it breathed at 8.5 — two capsules
        // on one bar, at two densities.
        .padding(.horizontal, ArgoSpacing.snug)
        // The contract reserves the brand hue for selection and focus; a symbol in a menu label
        // takes the control's accent unless the control says otherwise.
        .tint(argo.color.text.tertiary)
    }
}

#Preview("Scope vessel") {
    ScopeVessel(presentation: .preview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Scope vessel — nothing registered") {
    ScopeVessel(presentation: .unregisteredPreview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
