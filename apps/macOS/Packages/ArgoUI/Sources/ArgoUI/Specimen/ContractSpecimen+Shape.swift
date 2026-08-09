import SwiftUI

/// The geometry half of the contract sheet: the radius rungs, and how far each elevation rung
/// stands off its ground.
///
/// Both families are mostly FLAT, and a specimen is the only place that reads as a decision
/// rather than as an omission — four of five elevation rungs cast nothing, and seeing them cast
/// nothing side by side is what says so.
extension ContractSpecimen {
    /// The radius rungs, each drawn at its own value so the difference between 3 and 6 is a shape
    /// rather than a number. `deck` is worth zero and is shown BEING zero.
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

    /// Every elevation rung on a ground it can actually cast onto. Four of the five are flat by
    /// contract, which is the point: depth here is tone and edge, and a shadow is the exception.
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
