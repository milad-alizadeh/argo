import SwiftUI

/// The geometry half of the contract sheet: the radius rungs, and how far each elevation rung
/// stands off its ground.
///
/// Both families are mostly FLAT: four of five elevation rungs cast nothing.
extension ContractSpecimen {
    /// The radius rungs, each drawn at its own value. `deck` is worth zero and is shown BEING zero.
    var shape: some View {
        section("Shape — a rung per kind of surface; the deck's flatness is a decision") {
            HStack(alignment: .top, spacing: ArgoSpacing.comfortable) {
                ForEach(ArgoRadius.all, id: \.name) { rung in
                    VStack(spacing: ArgoSpacing.tight) {
                        RoundedRectangle(cornerRadius: rung.radius)
                            .fill(argo.color.surface.raised)
                            .overlay {
                                RoundedRectangle(cornerRadius: rung.radius)
                                    .strokeBorder(
                                        argo.color.edge.subtle,
                                        lineWidth: ArgoStroke.border,
                                    )
                            }
                            .frame(width: 88, height: 44)
                        Text("\(rung.name) · \(Int(rung.radius))")
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    /// Both presence rungs, on a surface rather than on a word: what ghosting dims is a whole row
    /// at once.
    var presence: some View {
        section("Presence — full, and the rung a surface nobody can drive is drawn at") {
            HStack(alignment: .top, spacing: ArgoSpacing.loose) {
                ForEach(ArgoOpacity.all, id: \.name) { rung in
                    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                            Text("The record of a Session").argoText(ArgoTypography.rowTitle)
                            Text("argo/#508-external-row-ghosted")
                                .argoText(ArgoTypography.rowMeta)
                                .foregroundStyle(argo.color.text.tertiary)
                        }
                        // The name stays at full presence: a label drawn at the rung it names
                        // is unreadable exactly where the rung is quietest.
                        .opacity(rung.value)
                        Text(rung.name).argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    /// Every elevation rung on a ground it can actually cast onto. Four of the five are flat by
    /// contract: depth here is tone and edge.
    var depth: some View {
        section("Depth — flat by default; a shadow is reserved for what genuinely floats") {
            HStack(alignment: .top, spacing: ArgoSpacing.loose) {
                ForEach(ArgoElevation.all, id: \.name) { rung in
                    VStack(spacing: ArgoSpacing.tight) {
                        RoundedRectangle(cornerRadius: ArgoRadius.control)
                            .fill(argo.color.surface.overlay)
                            .frame(width: 88, height: 44)
                            .argoShadow(rung.elevation)
                        Text(rung.name)
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                        unwired(ArgoElevation.unwired[rung.name])
                    }
                }
            }
            .padding(.bottom, ArgoSpacing.snug)
        }
    }
}
