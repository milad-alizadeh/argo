import ArgoDesign
import ArgoUI
import SwiftUI

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
