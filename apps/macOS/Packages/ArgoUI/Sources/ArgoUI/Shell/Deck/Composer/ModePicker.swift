import SwiftUI

/// The `Read Only · Plan · Code · Auto` ladder, as a bespoke `Menu`.
struct ModePicker: View {
    @Environment(\.argo) private var argo

    @Binding var mode: ComposerMode

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Menu {
                // Inline, or the rungs land in a submenu — and it is what ticks the selected one.
                Picker("Mode", selection: $mode) {
                    ForEach(ComposerMode.allCases) { rung in
                        Label(rung.rawValue, systemImage: rung.mark).tag(rung)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } label: {
                // The label style sizes the mark by FONT. `ArgoGlyph` frames by ink height, and
                // framing a short wide glyph like `</>` up to a 10pt ink height scales its stroke
                // with it — rendered, it drew a 2pt rule beside the word's 1pt one.
                Label(mode.rawValue, systemImage: mode.mark)
                    .labelStyle(.argo(ArgoTypography.control))
            }
            // Not `.borderlessButton`: that wraps its label in about 10pt of its own padding, which
            // puts the pill 10 over the width `composer/rest.png` measures.
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            // A button-styled `Menu` paints its label with the accent and reads the TINT — a
            // `foregroundStyle` set anywhere around it loses.
            .tint(argo.color.text.primary)
            // Or the label stretches and the control stops hugging the rung.
            .fixedSize()
            // Beside the label: a `Menu` re-synthesises its label from icon and title alone, so a
            // chevron inside one never draws.
            Image(systemName: ArgoSymbol.disclosure)
                .argoIcon(.inline)
                .foregroundStyle(argo.color.text.secondary)
        }
        .padding(.horizontal, ArgoSpacing.snug)
        .frame(height: ArgoComposerVessel.modeHeight)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
        }
        .help("\(mode.rawValue) — \(mode.boundary)")
        .accessibilityLabel("Mode, \(mode.rawValue), \(mode.boundary)")
    }
}

// Trailing-aligned, so the four widths are read against the edge they share.
#Preview("Mode picker — every rung, at its own width") {
    VStack(alignment: .trailing, spacing: ArgoSpacing.base) {
        ForEach(ComposerMode.allCases) { rung in
            ModePicker(mode: .constant(rung))
        }
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}
