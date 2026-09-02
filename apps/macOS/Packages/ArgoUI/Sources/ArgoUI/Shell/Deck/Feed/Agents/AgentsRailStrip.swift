import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The rail collapsed: one state dot per Agent, and the chevron back.
///
/// Dots rather than nothing at all, because what the rail is glanced at to answer survives losing
/// the names — how many are working — and a rail that vanished would need a control floating over
/// the feed to bring it back.
struct AgentsRailStrip: View {
    @Environment(\.argo) private var argo

    let agents: [FeedAgent]
    /// The same control the expanded rail writes, so both forms answer a click identically — what
    /// selecting does is the control's (`AgentsRailControl.select`), never each form's own.
    let control: AgentsRailControl

    /// A ScrollView, exactly as the expanded rail is: thirty dots outgrow the column too, and
    /// `argoScrollsUnderCanopy` insets SCROLL content — on a plain stack it is a no-op, so the
    /// first dots end up drawn behind the glass.
    var body: some View {
        ScrollView {
            LazyVStack(spacing: ArgoSpacing.snug) {
                // `.plain` for the reason the rail's own heading takes it: a filled control ground
                // here would be a card in a column 28 points wide.
                Button { control.isCollapsed = false } label: {
                    ArgoDisclosure(.beside).argoHitTarget()
                }
                .buttonStyle(.plain)
                .accessibilityLabel(AgentsRailCopy.show)
                main
                ForEach(agents) { dot($0) }
            }
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(.vertical, ArgoSpacing.base)
        }
        .argoScrollsUnderCanopy()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(AgentsRailCopy.collapsed)
    }

    /// The Session's own reading, above the Agents here as it is in the expanded rail (#1013) —
    /// without it the way back vanishes the moment somebody collapses the column.
    ///
    /// A MARK where the Agents have a state dot, because the label is what a 28-point column has no
    /// room for: a dot here would either claim a state this row does not have or read as one more
    /// Agent.
    private var main: some View {
        Button(action: control.selectSession) {
            ArgoGlyph(ArgoSymbol.sessionReading, .control)
                .foregroundStyle(argo.color.text.secondary)
                .padding(ArgoSpacing.hair)
                .background(
                    control.scope.isSession ? argo.color.surface.selected : .transparent,
                    in: .rect(cornerRadius: ArgoRadius.marker),
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(AgentsRailCopy.main)
        .accessibilityAddTraits(control.scope.isSession ? [.isSelected] : [])
    }

    /// The dot carries the whole row's meaning here, so its label says what the chip's name would.
    @ViewBuilder private func dot(_ agent: FeedAgent) -> some View {
        let isSelected = control.scope.agent == agent.id
        let indicator = SessionStateIndicator(state: agent.isRunning ? .running : .idle)
            .padding(ArgoSpacing.tight)
            .background(
                isSelected ? argo.color.surface.selected : .transparent,
                in: .rect(cornerRadius: ArgoRadius.marker),
            )

        if let select = control.select(agent) {
            Button(action: select) { indicator }
                .buttonStyle(.plain)
                .accessibilityLabel(agent.label)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        } else {
            indicator.accessibilityLabel(agent.label)
        }
    }
}

#Preview("Agents rail collapsed — a fan-out as dots, under the Session's own reading") {
    @Previewable @State var scope = FeedScope.session
    @Previewable @State var isCollapsed = true

    AgentsRailStrip(
        agents: FeedAgents.all(in: FeedProjection.previewRows, of: .running),
        control: AgentsRailControl(
            scope: $scope,
            isCollapsed: $isCollapsed,
            readings: AgentsRailFixture.readings,
        ),
    )
    .frame(width: ArgoAgentsRail.collapsedWidth, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agents rail collapsed — one Agent scoped onto, and the mark back") {
    @Previewable @State var scope = FeedScope.subagent(2)
    @Previewable @State var isCollapsed = true

    AgentsRailStrip(
        agents: FeedAgents.all(in: FeedProjection.previewRows, of: .running),
        control: AgentsRailControl(
            scope: $scope,
            isCollapsed: $isCollapsed,
            readings: AgentsRailFixture.readings,
        ),
    )
    .frame(width: ArgoAgentsRail.collapsedWidth, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}
