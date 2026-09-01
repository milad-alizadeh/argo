import SwiftUI

/// This Project, on this checkout — the two halves and the rule between them, as one control.
///
/// No glass of its own: the single toolbar item hosting it supplies that, and one capsule around
/// both is the whole claim. It tints the pair, so the merged vessel speaks in one colour.
struct ScopeVessel: View {
    @Environment(\.argo) private var argo

    let project: ProjectVesselReading
    /// The menu hangs off the Project half, so its rows arrive with it.
    let rows: [ProjectMenuProjection.Row]
    let checkout: CheckoutReading
    let actions: CockpitActions

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ProjectVessel(reading: project, rows: rows, actions: actions)
            DeckSeparator()
                .frame(height: ArgoToolbarVessel.scopeDividerHeight)
                .accessibilityHidden(true)
            GitVessel(reading: checkout, refresh: actions.retry.checkout)
        }
        // The toolbar draws the glass but not the room inside it. Without this the folder mark sat
        // ~3.5pt off its own rim while the Rooms vessel next to it breathed at 8.5 — two capsules
        // on one bar, at two densities.
        .padding(.horizontal, ArgoSpacing.snug)
        // The rule between the halves only. Each half states its OWN tint since #875, because each
        // is a menu now and a menu takes its label's ink from there — one tint for both would put
        // the checkout at the Project's weight.
        .foregroundStyle(argo.color.text.tertiary)
    }
}

extension ScopeVessel {
    /// The one place on the bar a presentation is projected.
    init(presentation: CockpitPresentation, actions: CockpitActions) {
        self.init(
            project: ProjectVesselReading(presentation: presentation),
            rows: ProjectMenuProjection.rows(from: presentation),
            checkout: CheckoutReading(presentation: presentation),
            actions: actions,
        )
    }
}

#Preview("Scope vessel") {
    ScopeVessel(
        project: ProjectVesselReading(presentation: .preview),
        rows: ProjectMenuProjection.rows(from: .preview),
        checkout: CheckoutReading(presentation: .preview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Scope vessel — nothing registered") {
    ScopeVessel(
        project: ProjectVesselReading(presentation: .unregisteredPreview),
        rows: ProjectMenuProjection.rows(from: .unregisteredPreview),
        checkout: CheckoutReading(presentation: .unregisteredPreview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
