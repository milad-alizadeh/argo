import SwiftUI

/// The one family this palette spends on a KIND rather than on a meaning, and the only one whose
/// rungs are derived — so nothing reflected can put them on the sheet and this draws them by hand
/// (#905).
extension ContractSpecimen {
    /// The run of hues categorical data is drawn in, as the fills they really are and in the
    /// order a chart spends them — touching, exactly as two slices of one pie are. That adjacency
    /// is the whole judgement: a swatch with air around it can pass for distinct when the wedge
    /// beside it will not.
    ///
    /// Each column is one hue at all three weights, spent at the top and full at the foot, so the
    /// row along the bottom is still the run as a pie spends it while the two rungs above it — the
    /// ones that knowingly stop meeting the separation the bottom row keeps — are looked at.
    var series: some View {
        section("Series — indexed hues for a chart, each at its three weights, full at the foot") {
            HStack(spacing: ArgoStroke.hairline) {
                ForEach(argo.color.series.hues.indices, id: \.self) { index in
                    VStack(spacing: ArgoSpacing.tight) {
                        rung(index)
                        Text(argo.color.series.all[index].name)
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    /// One hue's three weights, stacked and touching, with the full rung at the bottom where the
    /// run reads as a row of hues — the two dimmed rungs are DERIVED, so nothing reflected can put
    /// them on this sheet and only drawing them by hand does (`design-system.md`, #905).
    private func rung(_ index: Int) -> some View {
        VStack(spacing: ArgoStroke.hairline) {
            ForEach(argo.color.series.ramp(index), id: \.name) { weight in
                Rectangle().fill(weight.color).frame(width: 68, height: 22)
            }
        }
    }
}
