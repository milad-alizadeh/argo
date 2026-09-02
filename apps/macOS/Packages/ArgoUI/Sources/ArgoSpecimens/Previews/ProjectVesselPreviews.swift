import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Project vessel") {
    ProjectVessel(
        reading: ProjectVesselReading(presentation: .preview),
        rows: ProjectMenuProjection.rows(from: .preview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project vessel — folder not found") {
    ProjectVessel(
        reading: ProjectVesselReading(presentation: .unreachablePreview),
        rows: ProjectMenuProjection.rows(from: .unreachablePreview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project vessel — nothing registered") {
    ProjectVessel(
        reading: ProjectVesselReading(presentation: .unregisteredPreview),
        rows: ProjectMenuProjection.rows(from: .unregisteredPreview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
