import SwiftUI

/// The `Read Only · Plan · Code · Auto` ladder, as a bespoke `Menu`.
///
/// It was `Picker(…).pickerStyle(.menu)`, which macOS draws through `NSPopUpButton`. Three things
/// the composer design asks for are three things that control cannot do (#608): ONE `chevron.down`
/// rather than the stepper pair, since this drops a list instead of cycling values; a width that
/// follows the SELECTED rung, since pinning it to `Read Only` left empty pill trailing `Code` and
/// `Auto`; and a MARK per rung, in the rows and on the closed control, since a word alone is what
/// put the boundary on the tooltip. The boundary stays there.
struct ModePicker: View {
    @Environment(\.argo) private var argo

    @Binding var mode: ComposerMode

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Menu {
                // Inline, so the rungs land as this menu's own items rather than a submenu — and
                // so the SELECTED one is ticked. A bespoke menu gets that from nowhere else: it is
                // the one thing the stock picker gave for free.
                Picker("Mode", selection: $mode) {
                    ForEach(ComposerMode.allCases) { rung in
                        Label(rung.rawValue, systemImage: rung.mark).tag(rung)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } label: {
                // The mark rides the label style's own rung rather than `ArgoGlyph`, which frames
                // by INK HEIGHT — and framing a short wide glyph like `</>` up to a 10pt ink
                // height scales its stroke with it, drawing a 2pt rule beside the word's 1pt one.
                // What the frame buys is four marks measuring alike side by side, and only one
                // rung is ever on the closed control.
                Label(mode.rawValue, systemImage: mode.mark)
                    .labelStyle(.argo(ArgoTypography.control))
            }
            .menuStyle(.button)
            // `.plain` for the padding, not the look: `.borderlessButton` wraps its label in about
            // 10pt of its own, which put the pill 10 over the width the design measures.
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            // A button-styled menu paints its label with the accent, and it reads the TINT rather
            // than a `foregroundStyle` set anywhere around it. A blue rung read as a link.
            .tint(argo.color.text.primary)
            // Without this the label stretches and the control stops hugging the rung, which is
            // the whole amendment.
            .fixedSize()
            // BESIDE the label, not inside it. A `Menu` re-synthesises its label from icon and
            // title alone, so a chevron in there never draws at all (`GitVessel` learned this
            // first). Quieter than the word, because it names the gesture and not the value.
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

// All four rungs stacked and trailing-aligned, because the WIDTH is what changed: they have to be
// seen against each other, on the edge they share, or nothing says the control hugs the word.
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
