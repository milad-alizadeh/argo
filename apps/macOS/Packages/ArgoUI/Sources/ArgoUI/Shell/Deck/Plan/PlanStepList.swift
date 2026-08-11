import ArgoEngine
import SwiftUI

/// The whole plan, revealed over the pill: every step in the agent's own order, each marked with
/// where it has got to.
struct PlanStepList: View {
    @Environment(\.argo) private var argo

    let plan: PlanReading

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
            Text("Plan · replaced whole by the agent")
                .argoText(ArgoTypography.sectionLabel)
                .textCase(.uppercase)
                .foregroundStyle(argo.color.text.tertiary)
            VStack(alignment: .leading, spacing: ArgoPlanPill.betweenSteps) {
                ForEach(plan.steps) { step in
                    PlanStepLine(step: step)
                }
            }
        }
        .padding(.horizontal, ArgoPlanPill.listInsetX)
        .padding(.vertical, ArgoPlanPill.listInsetY)
        .frame(width: ArgoPlanPill.listWidth, alignment: .leading)
        // The pill's own material: this is the second half of one surface.
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
    }
}

/// One step, as its mark and its words.
private struct PlanStepLine: View {
    @Environment(\.argo) private var argo

    let step: PlanReading.Step

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.base) {
            ArgoGlyph(reading.mark, .inline)
                .foregroundStyle(markInk)
                .frame(width: ArgoPlanPill.markWidth)
            Text(step.text)
                .argoText(ArgoTypography.body)
                .foregroundStyle(ink)
                // The EDGE ink, so the rule reads as a mark over the words and not a second line.
                .strikethrough(step.status == .completed, color: argo.color.edge.strong.color)
                .lineLimit(ArgoPlanPill.stepLines)
                .fixedSize(horizontal: false, vertical: true)
        }
        // `.ignore` and not `.combine`: combining leaves a static text whose VALUE is the words
        // and whose label is dropped, which loses the status entirely.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(step.text), \(reading.spoken)")
    }

    /// The three-state table, in ONE place: two switches over one enum drift apart a case at a
    /// time.
    private var reading: (mark: String, spoken: String) {
        switch step.status {
        case .pending: (ArgoSymbol.stepPending, "pending")
        case .inProgress: (ArgoSymbol.stepInProgress, "in progress")
        case .completed: (ArgoSymbol.stepCompleted, "completed")
        }
    }

    /// Only the step under way is tinted.
    private var markInk: ArgoColor {
        step.status == .inProgress ? argo.color.state.running : argo.color.text.tertiary
    }

    private var ink: ArgoColor {
        step.status == .inProgress ? argo.color.text.primary : argo.color.text.tertiary
    }
}

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
