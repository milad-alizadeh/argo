import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Project disabled — folder not found") {
    if let reading = ProjectDisabledReading(presentation: .unreachablePreview) {
        ProjectDisabledScreen(
            reading: reading,
            repair: ProjectRepair(projectID: reading.projectID, actions: .inert),
        )
        .frame(width: ArgoLayout.windowMinimumWidth, height: ArgoLayout.windowMinimumHeight)
        .argoAppearance()
    }
}
