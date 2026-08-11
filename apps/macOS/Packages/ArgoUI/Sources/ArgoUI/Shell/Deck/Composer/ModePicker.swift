import ArgoEngine
import SwiftUI

/// The `Read Only · Plan · Code · Auto` ladder, as a bespoke `Menu`.
///
/// It draws a READING rather than a choice (#545): a stance the ladder has no rung for draws the
/// nearest one marked `≈`, or `unknown` where there is none, and neither ticks a row.
struct ModePicker: View {
    @Environment(\.argo) private var argo

    let reading: SessionModeReading
    /// Put the Session on a rung. A refusal is answered on the composer's seam.
    var setMode: (SessionMode) -> Void = { _ in }

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Menu {
                // The header states what the CLI reports, for the reader who opened the control
                // instead of hovering it. Only where the reading is not the ladder's own — an
                // exact rung has nothing to footnote, and gets no header at all.
                if let report = reading.report {
                    Section(report) { rungs }
                } else {
                    rungs
                }
            } label: {
                // The label style sizes the mark by FONT. `ArgoGlyph` frames by ink height, and
                // framing a short wide glyph like `</>` up to a 10pt ink height scales its stroke
                // with it — rendered, it drew a 2pt rule beside the word's 1pt one.
                Label(reading.word, systemImage: reading.mark)
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
        .help(reading.help)
        .accessibilityLabel("Mode, \(reading.help)")
    }

    /// All four rungs, always — a Session Argo cannot place on the ladder can still be put on one.
    private var rungs: some View {
        // Inline, or the rungs land in a submenu — and it is what ticks the selected one.
        Picker("Mode", selection: selection) {
            ForEach(SessionMode.allCases, id: \.self) { rung in
                Label(rung.label, systemImage: rung.mark).tag(Optional(rung))
            }
        }
        .pickerStyle(.inline)
        .labelsHidden()
    }

    /// Optional on purpose: an inexact reading selects nothing, which leaves every row unticked.
    private var selection: Binding<SessionMode?> {
        Binding(get: { reading.exactRung }, set: { rung in rung.map(setMode) })
    }
}

// Trailing-aligned, so the four widths are read against the edge they share.
#Preview("Mode picker — every rung, at its own width") {
    VStack(alignment: .trailing, spacing: ArgoSpacing.base) {
        ForEach(SessionMode.allCases, id: \.self) { rung in
            ModePicker(reading: .exactly(rung, cli: "acceptEdits"))
        }
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Mode picker — a stance with no rung of its own") {
    VStack(alignment: .trailing, spacing: ArgoSpacing.base) {
        ModePicker(reading: .nearly(.readOnly, cli: "default"))
        ModePicker(reading: .nearly(.auto, cli: "bypassPermissions"))
        ModePicker(reading: .unknown(cli: "dontAsk"))
        ModePicker(reading: .unknown(cli: nil))
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}
