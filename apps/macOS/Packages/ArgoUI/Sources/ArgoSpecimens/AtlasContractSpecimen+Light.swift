import ArgoDesign
import ArgoUI
import SwiftUI

/// The light model and the materials it lands on — the half of this sheet that is the PLACE rather
/// than the reading laid over it.
extension AtlasContractSpecimen {
    /// The three lamps as what they are — a tint and a strength — and then the rule they are held
    /// to, drawn: each band beside itself at both shades.
    ///
    /// The judgement this exists for is the one no assertion makes: that a shaded band is still
    /// the same colour. The claim in `ArgoLightTests` says the ratios did not move; only a render
    /// says whether the eye agrees.
    var light: some View {
        section("Light — a scalar multiply on a band's own pigment, never a hue shift") {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                HStack(spacing: ArgoSpacing.loose) {
                    ForEach(ArgoLight.all, id: \.name) { lamp in
                        lampChip(lamp)
                    }
                }
                HStack(alignment: .top, spacing: ArgoSpacing.loose) {
                    ForEach(argo.color.atlas.measure.all, id: \.name) { band in
                        shaded(band)
                    }
                }
            }
        }
    }

    /// One lamp: its tint, and the numbers a shader takes it as.
    private func lampChip(_ lamp: (name: String, lamp: ArgoLight.Lamp)) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            AtlasSwatch(name: lamp.name, color: lamp.lamp.tint)
            Text(reading(lamp.lamp))
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
            // Every lamp here is unjudged until the Metal renderer draws one, and the sheet says
            // so rather than letting three undrawn values pass for settled ones.
            unwired(ArgoLight.unwired[lamp.name])
        }
    }

    /// A lamp with no direction is the sky term, and says so rather than drawing three zeroes.
    private func reading(_ lamp: ArgoLight.Lamp) -> String {
        let strength = "×\(String(format: "%.2f", lamp.intensity))"
        guard lamp.direction != .zero else { return "\(strength) · from everywhere" }
        let direction = [lamp.direction.x, lamp.direction.y, lamp.direction.z]
            .map { String(format: "%.2f", $0) }
            .joined(separator: ", ")
        return "\(strength) · \(direction)"
    }

    /// One band at full pigment and at both shades, touching. Anything that moved a hue would show
    /// here as a stripe that is not the same colour three times.
    private func shaded(_ band: (name: String, color: ArgoColor)) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text("\(band.name) · lit")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
            HStack(spacing: ArgoStroke.hairline) {
                AtlasSwatch(name: "full", color: band.color)
                ForEach(ArgoLight.shades, id: \.name) { shade in
                    AtlasSwatch(name: shade.name, color: band.color.scaled(by: shade.value))
                }
            }
        }
    }

    /// The place itself. The plates are drawn ON the desktop, which is the only way the ladder can
    /// be judged: three tones a shade apart read as three depths against that ground and as one
    /// smudge against any other.
    var materials: some View {
        section("The place — the ground, three plates for three depths, and the floor's light") {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                swatches(argo.color.atlas.materials.grounds)
                inferredInk
            }
        }
    }

    /// The one promoted role that is an INK: a domain is inferred, never DIRECT, and every label
    /// on one is drawn in this. Shown as words for the reason the text rungs are — a chip of it
    /// says nothing about whether the name of a region is readable at 13pt.
    private var inferredInk: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
            label("inferred")
            Text("rendering · inferred from 34 files")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.atlas.materials.inferred)
                .padding(ArgoSpacing.snug)
                .background(argo.color.atlas.materials.plate2)
        }
    }
}
