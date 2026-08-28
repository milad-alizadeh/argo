import ArgoEngine
import SwiftUI

/// The `Read Only · Plan · Code · Auto` ladder, as the platform's own pull-down.
///
/// It draws a READING rather than a choice (#545): a stance the ladder has no rung for draws the
/// nearest one under a `≈`, or `unknown` where there is none, and neither ticks a row.
///
/// **Stock, deliberately (#875).** It used to wear a hand-drawn ground, an `edge.subtle` stroke at
/// `ArgoRadius.control`, a pinned height and a chevron drawn beside the label — four decisions
/// spent to arrive at what `Menu` draws by itself. The ground, the capsule and the indicator are
/// the system's now, which is also what puts this control's press, focus and hover on the same
/// footing as every other pull-down the reader meets.
struct ModePicker: View {
    @Environment(\.argo) private var argo

    let reading: SessionModeReading
    /// Put the Session on a rung. A refusal is answered on the composer's seam.
    var setMode: (SessionMode) -> Void = { _ in }

    var body: some View {
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
        // A `Menu` paints its label with the accent and reads the TINT — a `foregroundStyle` set
        // anywhere around it loses. Ion Blue is spent on selection and focus, not on a label.
        .tint(argo.color.text.primary)
        // Or the label stretches and the control stops hugging the rung.
        .fixedSize()
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
