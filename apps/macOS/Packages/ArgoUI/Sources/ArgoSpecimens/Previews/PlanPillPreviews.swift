import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Plan pill — a step under way") {
    PlanPill(plan: PlanFixture.working)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Plan pill — the list revealed") {
    PlanPill(plan: PlanFixture.working, isRevealed: true)
        .padding(.top, 240)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Plan pill — a plan the agent has not started") {
    PlanPill(plan: PlanFixture.unstarted)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Plan pill — a plan with every step behind it") {
    PlanPill(plan: PlanFixture.finished)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Plan pill — one step") {
    PlanPill(plan: PlanFixture.single)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Plan pill — a step longer than the pill") {
    PlanPill(plan: PlanFixture.wordy)
        .frame(width: 420)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}
