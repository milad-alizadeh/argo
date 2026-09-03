import ArgoDesign
import ArgoUI
import SwiftUI

/// The five families the Atlas promoted into the contract, side by side: the measure ramp, the
/// domain wheel, the light model, the map's own materials and the accent tint ladder (#1142).
///
/// Its own sheet rather than five more sections on `ContractSpecimen`, for the reason `DiffRoles`
/// has its own file: these answer one question — what is the map made of — and none of them means
/// anything anywhere else in the app. `VisualContractCoverageTests` reflects the two colour groups
/// against the catalogues drawn here, so a role added to either arrives on this sheet or reds.
///
/// It is drawn on the DESKTOP rather than on the deck. That is the ground every one of these
/// colours is really read against, and a plate judged over the deck is a plate judged over the
/// wrong tone.
struct AtlasContractSpecimen: View, SpecimenSheet {
    @Environment(\.argo) var argo

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                measure
                domains
                light
                materials
                ladder
            }
            .padding(ArgoSpacing.section)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(argo.color.atlas.materials.desktop)
    }

    /// A run of swatches, touching — which is how they are really read: two regions of a map share
    /// an edge, and a swatch with air around it can pass for distinct when the region beside it
    /// will not.
    func swatches(_ roles: [(name: String, color: ArgoColor)]) -> some View {
        HStack(spacing: ArgoSpacing.tight) {
            ForEach(roles, id: \.name) { role in
                AtlasSwatch(name: role.name, color: role.color)
            }
        }
    }
}

/// One labelled chip: the colour, and what it is called under it.
struct AtlasSwatch: View {
    @Environment(\.argo) var argo
    let name: String
    let color: ArgoColor

    var body: some View {
        VStack(spacing: ArgoSpacing.tight) {
            Rectangle()
                .fill(color)
                .frame(width: 76, height: 34)
                .overlay {
                    Rectangle()
                        .strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.hairline)
                }
            Text(name)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
        }
    }
}

#Preview("Atlas contract") {
    AtlasContractSpecimen()
        .frame(width: 900, height: 900)
        .argoAppearance()
}
