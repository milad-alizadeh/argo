import SwiftUI

/// This Project, on this checkout — the two halves and the rule between them, as one control.
///
/// Two readings and not one: the halves are drawn together but answer about different entities, a
/// Project and a Workspace. No glass of its own: the single toolbar item hosting it supplies that,
/// and one capsule around both is the whole claim. It tints the pair, so the merged vessel speaks
/// in one colour.
struct ScopeVessel: View {
    @Environment(\.argo) private var argo

    let project: ProjectVesselReading
    /// The drawer hangs off the Project half, so its rows arrive with it.
    let rows: [ProjectDrawerProjection.Row]
    let checkout: CheckoutReading
    let actions: CockpitActions

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ProjectVessel(reading: project, rows: rows, actions: actions)
            DeckSeparator()
                .frame(height: ArgoLayout.scopeDividerHeight)
                .accessibilityHidden(true)
            GitVessel(reading: checkout, refresh: actions.refreshCheckout)
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

extension ScopeVessel {
    /// The one place on the bar a presentation is projected. Everything below this line takes
    /// values, so every claim the toolbar makes is asserted without rendering anything.
    init(presentation: CockpitPresentation, actions: CockpitActions) {
        self.init(
            project: ProjectVesselReading(presentation: presentation),
            rows: ProjectDrawerProjection.rows(from: presentation),
            checkout: CheckoutReading(presentation: presentation),
            actions: actions,
        )
    }
}

#Preview("Scope vessel") {
    ScopeVessel(
        project: ProjectVesselReading(presentation: .preview),
        rows: ProjectDrawerProjection.rows(from: .preview),
        checkout: CheckoutReading(presentation: .preview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Scope vessel — nothing registered") {
    ScopeVessel(
        project: ProjectVesselReading(presentation: .unregisteredPreview),
        rows: [],
        checkout: CheckoutReading(presentation: .unregisteredPreview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
