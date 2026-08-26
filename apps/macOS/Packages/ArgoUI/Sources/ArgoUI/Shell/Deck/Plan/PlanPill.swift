import SwiftUI

/// The plan, as one line floating above the dock: where the agent says it is, and how far along.
/// Standing state on a standing surface, not in the feed (#425) — the agent replaces the list
/// whole every time it moves.
struct PlanPill: View {
    @Environment(\.argo) private var argo

    let plan: PlanReading
    /// Whether the list is showing before anybody opened it — a specimen's seam, since a click
    /// cannot be reached from a screenshot.
    var isRevealed = false

    /// Opened by a click and by nothing else: the list stands over the middle of the reading, so a
    /// pointer crossing the pill on its way somewhere may not open it.
    @State private var isOpen = false
    @FocusState private var isFocused: Bool

    var body: some View {
        pill
            // Above: the pill sits at the bottom of the deck, so a list opening downward would
            // open into the dock.
            .overlay(alignment: .top) { list }
            .argoAnimation(.reveal, value: showsList)
            .accessibilityElement(children: .contain)
    }

    /// The list, standing on the pill's own top edge.
    private var list: some View {
        PlanStepList(plan: plan)
            .padding(.bottom, ArgoPlanPill.listGap)
            .alignmentGuide(.top) { $0[.bottom] }
            .opacity(showsList ? 1 : 0)
            // Not merely invisible: a hidden list still under the pointer would eat the clicks
            // meant for the feed behind it.
            .allowsHitTesting(showsList)
            .accessibilityHidden(!showsList)
    }

    private var showsList: Bool {
        isRevealed || isOpen
    }

    /// A Button rather than a tap gesture, so Space and Return open the list for a keyboard the
    /// same way a click does — and `ESC` gives it back, since the list stands over the reading.
    ///
    /// Focusable for that Escape alone: `onExitCommand` only fires for a view in the responder
    /// chain. The ring comes with being in it — the pill floats over the reading, so what has focus
    /// is not otherwise evident.
    private var pill: some View {
        Button { isOpen.toggle() } label: { line }
            .buttonStyle(.plain)
            .focusable()
            .focused($isFocused)
            .focusEffectDisabled()
            .argoFocusRing(isFocused, in: Capsule())
            .onExitCommand { isOpen = false }
            // On the PILL and not on the view that also holds the list: an element spanning both
            // puts this label on a frame the pointer cannot land in.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Plan")
            .accessibilityValue(spoken)
            .accessibilityHint(showsList ? "Hides the steps" : "Shows the steps")
    }

    private var line: some View {
        HStack(spacing: ArgoPlanPill.gap) {
            PlanRing(progress: plan.progress)
            PlanCounter(counter: counter)
            Text(currentStep)
                .argoText(ArgoTypography.body)
                .foregroundStyle(currentStepInk)
                .lineLimit(1)
        }
        .padding(.horizontal, ArgoPlanPill.insetX)
        .padding(.vertical, ArgoPlanPill.insetY)
        .argoFloatingGlass(in: .capsule)
    }

    /// Where the agent is in the list — or, when the list names no step in progress, how much of
    /// it is behind it. Never a position for a step the plan never claimed.
    ///
    /// Both readings come out together — what it says now, and the longest it can say it for this
    /// plan — because the pair is what lets the pill hold still.
    private var counter: PlanCounter.Reading {
        guard let position = plan.position else {
            return PlanCounter.Reading(
                shown: "\(plan.completed)/\(plan.count) done",
                widest: "\(plan.count)/\(plan.count) done",
            )
        }
        return PlanCounter.Reading(
            shown: "Step \(position)/\(plan.count)",
            widest: "Step \(plan.count)/\(plan.count)",
        )
    }

    private var currentStep: String {
        plan.current?.text ?? "No step in progress"
    }

    /// The absence is set in the quiet ink: it is a statement about the record rather than
    /// something the agent said.
    private var currentStepInk: ArgoColor {
        plan.current == nil ? argo.color.text.tertiary : argo.color.text.primary
    }

    private var spoken: String {
        "\(counter.shown), \(currentStep)"
    }
}

/// How far along the plan is, in words, holding still while it changes.
///
/// Two things keep it still, and neither is enough alone: the machine face, which makes every digit
/// the same width, and a lane sized to the longest the counter can get for THIS plan, which absorbs
/// `9/12` becoming `10/12`. Leading-aligned in that lane, so a number does not slide right as it
/// grows.
private struct PlanCounter: View {
    /// What it says now, and the longest it can say it before the plan itself changes.
    struct Reading {
        let shown: String
        let widest: String
    }

    @Environment(\.argo) private var argo

    let counter: Reading

    var body: some View {
        Text(counter.widest)
            .argoText(ArgoTypography.machineBody)
            .hidden()
            .overlay(alignment: .leading) {
                Text(counter.shown)
                    // The step text's own size. A rung below it, the counter read as a footnote to
                    // a sentence when it is the half of the line that moves.
                    .argoText(ArgoTypography.machineBody)
                    .foregroundStyle(argo.color.text.tertiary)
                    .fixedSize()
            }
            .accessibilityHidden(true)
    }
}

/// How far the plan has got, as an arc. Drawn from what is COMPLETED, so it stays honest on a plan
/// that marks no current step.
private struct PlanRing: View {
    @Environment(\.argo) private var argo

    let progress: Double

    var body: some View {
        Circle()
            .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
            .overlay {
                Circle()
                    .trim(from: 0, to: progress)
                    // From the top, the way progress is read on a clock rather than on a chart.
                    .rotation(.degrees(-90))
                    .stroke(argo.color.state.running, lineWidth: ArgoStroke.indicator)
                    .padding(ArgoStroke.indicator)
            }
            .frame(width: ArgoPlanPill.ringSize, height: ArgoPlanPill.ringSize)
            // The arc says what the counter beside it already says in words.
            .accessibilityHidden(true)
    }
}

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
