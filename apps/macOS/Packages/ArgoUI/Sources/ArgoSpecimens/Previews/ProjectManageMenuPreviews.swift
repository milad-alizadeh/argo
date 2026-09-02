import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Manage a Project") {
    Menu("Manage") {
        ProjectManageMenu(row: ProjectMenuProjection.rows(from: .preview)[0], actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Manage a Project — folder not found") {
    Menu("Manage") {
        ProjectManageMenu(
            row: ProjectMenuProjection.rows(from: .unreachablePreview)[0],
            actions: .inert,
        )
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
