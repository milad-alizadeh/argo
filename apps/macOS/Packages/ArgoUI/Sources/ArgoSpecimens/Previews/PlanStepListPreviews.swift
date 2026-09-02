import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Plan list — a plan under way") {
    PlanStepList(plan: PlanFixture.working)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Plan list — a plan that names no current step") {
    PlanStepList(plan: PlanFixture.unstarted)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Plan list — steps longer than the measure") {
    PlanStepList(plan: PlanFixture.wordy)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}
