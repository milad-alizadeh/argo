import ArgoEngine
import SwiftUI

/// The whole plan, revealed over the pill.
///
/// Every step, in the agent's own order, each marked with where it has got to. It is the second
/// half of one surface rather than a panel of its own: the pill answers "where is it", and this
/// answers the only follow-up worth a gesture — "out of what".
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
        // The pill's own material: this is the second half of one surface, and two materials
        // across a gap the pointer crosses would read as two.
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
                // The EDGE ink, so the rule reads as a mark over the words rather than as a
                // second, louder line of them.
                .strikethrough(step.status == .completed, color: argo.color.edge.strong.color)
                .lineLimit(ArgoPlanPill.stepLines)
                .fixedSize(horizontal: false, vertical: true)
        }
        // `.ignore` and not `.combine`: combining leaves a static text whose VALUE is the words
        // and whose label is dropped, which loses the status entirely.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(step.text), \(reading.spoken)")
    }

    /// The three-state table, in ONE place. What the status looks like and what it is called are
    /// the same fact twice, and two switches over one enum drift apart a case at a time.
    private var reading: (mark: String, spoken: String) {
        switch step.status {
        case .pending: (ArgoSymbol.stepPending, "pending")
        case .inProgress: (ArgoSymbol.stepInProgress, "in progress")
        case .completed: (ArgoSymbol.stepCompleted, "completed")
        }
    }

    /// Only the step under way is tinted. A tick per finished step in the state ink would put four
    /// greens on a list whose one interesting line is the fifth.
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
