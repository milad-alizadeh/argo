import ArgoDesign
import ArgoUI
import SwiftUI

/// The measure ramp and the accent ladder: the two families on this sheet whose point is a
/// STRENGTH rather than a colour, and neither of which any reflected list can reach.
extension AtlasContractSpecimen {
    /// A traffic light, drawn three ways in one place, because three different things have to be
    /// judged: whether green-amber-red still reads as green-amber-red at this saturation, whether
    /// the pass bands rather than washes, and whether a fraction lands in the band the legend
    /// says it does.
    var measure: some View {
        section("Measure — three ordered bands, and where each takes over") {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                swatches(argo.color.atlas.measure.all)
                bandedPass
                sampled
            }
        }
    }

    /// The ramp as one pass. Each band is two stops at one colour, so the edges are hard — a wash
    /// here would mean the legend is lying about what a colour is worth.
    private var bandedPass: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
            label("measure · pass")
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                argo.color.atlas.measure.ramp.pass
                    .frame(width: 420, height: ArgoIconSize.control.rawValue)
                Text("0 — quiet — 0.5 — middling — 0.85 — hot — 1")
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        }
    }

    /// The lookup, drawn: eleven fractions across the range, each at the colour the ramp resolves
    /// it to. Every chip has to be one of the three above it — a chip that is not is a file drawn
    /// in a colour that is in no legend.
    private var sampled: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
            label("measure · lookup")
            HStack(spacing: ArgoStroke.hairline) {
                ForEach(0 ... 10, id: \.self) { step in
                    VStack(spacing: ArgoSpacing.tight) {
                        Rectangle()
                            .fill(argo.color.atlas.measure.ramp.color(at: Double(step) / 10))
                            .frame(width: 34, height: 26)
                        Text("\(step)")
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    /// The brand hue at the three weights a tint is laid down at, each on the ground it is really
    /// spent on and each carrying what it has to carry: a wash is read THROUGH, a muted ground has
    /// one word on it, and a rim is an edge with nothing on it at all.
    ///
    /// Derived, so no reflected list can catch a rung going undrawn — `ladder` is the catalogue
    /// this reads, and drawing it by hand is the gate (`rules/swift.md`).
    var ladder: some View {
        section("Accent ladder — one hue at the three weights a tint is laid down at") {
            HStack(spacing: ArgoSpacing.loose) {
                ForEach(argo.color.interaction.ladder, id: \.name) { rung in
                    VStack(spacing: ArgoSpacing.tight) {
                        rungMark(rung)
                        Text(rung.name)
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    /// A rung on the plate it is laid on. `rim` is drawn as the edge it is; the other two are
    /// grounds, with the words they have to stay under.
    private func rungMark(_ rung: (name: String, color: ArgoColor)) -> some View {
        Text("ArgoEngine")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .frame(width: 132, height: 40)
            .background(rung.name == "accent rim" ? ArgoColor.transparent : rung.color)
            .overlay {
                Rectangle().strokeBorder(
                    rung.name == "accent rim" ? rung.color : argo.color.edge.hairline,
                    lineWidth: ArgoStroke.border,
                )
            }
            .background(argo.color.atlas.materials.plate1)
    }
}
