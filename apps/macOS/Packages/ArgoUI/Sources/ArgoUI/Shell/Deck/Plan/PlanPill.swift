import SwiftUI

/// The plan, as one line floating above the dock: where the agent says it is, and how far along.
///
/// It is not in the feed on purpose (#425). A to-do list interleaved with the work is noise — the
/// agent replaces the list whole every time it moves, so a feed that drew each one would carry
/// four near-identical copies of it between what the agent actually said. Standing state gets a
/// standing surface, and this is it.
struct PlanPill: View {
    @Environment(\.argo) private var argo

    let plan: PlanReading
    /// Whether the list is showing before anything is pointed at or focused.
    ///
    /// A specimen's seam. Hover cannot be reached from a screenshot, and the revealed list is
    /// half of what this surface IS — without a way in, it is a state nobody ever looks at.
    var isRevealed = false

    @State private var isPointedAt = false
    @State private var isPointedAtList = false
    @FocusState private var isFocused: Bool

    var body: some View {
        pill
            // Above: the pill sits at the bottom of the deck, so a list opening downward would
            // open into the dock.
            .overlay(alignment: .top) { list }
            .argoAnimation(.reveal, value: showsList)
            .accessibilityElement(children: .contain)
    }

    /// The list, standing on the pill's own top edge — the gap between them is padding INSIDE this
    /// view rather than space outside it, so the two hover regions meet. Pointed at across a gap
    /// that belonged to neither, the list closed itself the moment the reader reached for it.
    private var list: some View {
        PlanStepList(plan: plan)
            .padding(.bottom, ArgoPlanPill.listGap)
            .alignmentGuide(.top) { $0[.bottom] }
            .opacity(showsList ? 1 : 0)
            // Not merely invisible: a hidden list still under the pointer would eat the clicks
            // meant for the feed behind it, and would open itself from empty space.
            .allowsHitTesting(showsList)
            .onHover { isPointedAtList = $0 }
            .accessibilityHidden(!showsList)
    }

    /// Revealed by any way in. Hover is the one a pointer finds and focus the one a keyboard does
    /// — the pill is focusable for exactly that reason, since a surface reachable only by hovering
    /// is one half the readers never open. The list keeps ITSELF open once it is: a reader who
    /// moves onto what they opened has not stopped reading it.
    private var showsList: Bool {
        isRevealed || isPointedAt || isPointedAtList || isFocused
    }

    private var pill: some View {
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
        // On the PILL and not on the view that also holds the list: an element spanning both puts
        // this label on a frame the pointer cannot land in.
        .onHover { isPointedAt = $0 }
        .focusable()
        .focused($isFocused)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Plan")
        .accessibilityValue(spoken)
    }

    /// Where the agent is in the list — or, when the list names no step in progress, how much of
    /// it is behind it. Never a position for a step that was not marked: the first pending entry
    /// is what the agent will do next, and reading it out as the current one would be the pill
    /// inventing the one fact it exists to report.
    ///
    /// Both readings come out together — what it says now, and the longest it can say it for this
    /// plan. Two properties deriving them apart would be one shape decided in two places, and the
    /// pair is the whole reason the pill can hold still.
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

    /// The absence is set in the quiet ink, because it is a statement about the record rather than
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
/// The one string in the pill that moves while the reader watches it, so it is the one that decides
/// whether the sentence beside it moves too. Two things keep it still, and neither is enough alone:
/// the machine face, which makes every digit the same width, and a lane sized to the longest the
/// counter can get for THIS plan, which absorbs `9/12` becoming `10/12`. Leading-aligned in that
/// lane, because a number that slid right as it grew would be the shift moved rather than removed.
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

/// How far the plan has got, as an arc.
///
/// A ring rather than a second number: the pill already carries the count in words, and this is
/// the reading you take without reading. It is drawn from what is COMPLETED, so it stays honest on
/// a plan that marks no current step — a finished list is full and an untouched one is empty,
/// neither of which needs a step in progress to say.
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
