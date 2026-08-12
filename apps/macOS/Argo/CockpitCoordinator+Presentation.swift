import ArgoUI

/// Everything the shell renders, projected by `CockpitPresentation(pointing:hub:annotations:)` —
/// which lives in ArgoUI, where a test can reach it. Nothing is derived here.
@MainActor
extension CockpitCoordinator {
    var presentation: CockpitPresentation {
        CockpitPresentation(pointing: pointing, hub: hub, annotations: annotations)
    }
}
