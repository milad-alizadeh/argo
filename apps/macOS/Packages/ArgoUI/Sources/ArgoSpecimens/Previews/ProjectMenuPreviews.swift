import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Project menu") {
    Menu("Projects") {
        ProjectMenu(rows: ProjectMenuProjection.rows(from: .preview), actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project menu — a Project whose folder is not there") {
    Menu("Projects") {
        ProjectMenu(rows: ProjectMenuProjection.rows(from: .unreachablePreview), actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project menu — nothing registered") {
    Menu("Projects") {
        ProjectMenu(rows: ProjectMenuProjection.rows(from: .unregisteredPreview), actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
