import ArgoDesign
import ArgoUI
import SwiftUI

/// The typographic part of the contract sheet: the platform's own scale with every rung drawn at
/// its own size, and every type role cast in the typeface it belongs to.
///
/// Each role is sampled with words of its OWN kind, because the judgement this exists for is
/// whether the sans and the mono are still doing two different jobs.
extension ContractSpecimen {
    /// The scale itself, every rung at its own size. Named as the HIG names them, because it IS the
    /// HIG's scale.
    var scale: some View {
        section("Type scale — the platform's own, from largeTitle to caption2") {
            VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
                ForEach(ArgoTypeScale.ladder, id: \.name) { rung in
                    HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                        Text("\(rung.name) · \(Int(rung.rung.size))pt")
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                            .frame(width: 132, alignment: .leading)
                        Text("The record of a Session").argoText(rung.rung)
                    }
                }
            }
        }
    }

    var type: some View {
        section("Type roles — SF Pro for what the interface says, SF Mono for machine facts") {
            VStack(alignment: .leading, spacing: ArgoSpacing.base) {
                ForEach(ArgoTypography.all, id: \.name) { role in
                    HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                        Text(role.name)
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                            .frame(width: 132, alignment: .leading)
                        Text(sample(for: role.style.typeface)).argoText(role.style)
                        unwired(ArgoTypography.unwired[role.name])
                    }
                }
            }
        }
    }

    private func sample(for typeface: ArgoTypeface) -> String {
        switch typeface {
        case .interface: "The cockpit observes what the agents are doing"
        case .machine: "git rev-parse HEAD → cb63695"
        }
    }
}
