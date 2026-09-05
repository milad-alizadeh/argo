import ArgoDesign
import ArgoUI
import SwiftUI

/// The rail opened onto the delegation that LANDED, which is the one meter `agentsRailMeasured`
/// cannot show: a finished chip sits behind the disclosure at the foot (#1090), and a screenshot
/// cannot click it.
///
/// The rail alone rather than beside its feed, exactly as `AgentsFanOutSpecimen` is: the claim here
/// is about one column's own contents, and the state is reached by seeding `showingFinished` rather
/// than by a gesture no still can make.
///
/// Its chips are the ones the DECK derives — `measuredReadings.agents(in:)`, the same call the rail
/// makes — so what this renders is the meter that ships rather than a list assembled by hand.
struct AgentsRailMeasuredSpecimen: View {
    var body: some View {
        AgentsRail(
            agents: AgentsRailFixture.measuredReadings.agents(in: AgentsRailFixture.measuredRows),
            control: AgentsRailControl(
                scope: .constant(.session),
                isCollapsed: .constant(false),
                readings: AgentsRailFixture.measuredReadings,
            ),
            showingFinished: true,
        )
        .frame(width: ArgoAgentsRail.width)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .argoDeckSurface()
    }
}

#Preview("Agents rail — the landed background chip, measured off its own file") {
    AgentsRailMeasuredSpecimen()
        .frame(width: 520, height: 480)
        .argoAppearance()
}
