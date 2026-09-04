import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Scope vessel") {
    ScopeVessel(
        project: ProjectVesselReading(presentation: .preview),
        rows: ProjectMenuProjection.rows(from: .preview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Scope vessel — nothing registered") {
    ScopeVessel(
        project: ProjectVesselReading(presentation: .unregisteredPreview),
        rows: ProjectMenuProjection.rows(from: .unregisteredPreview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
