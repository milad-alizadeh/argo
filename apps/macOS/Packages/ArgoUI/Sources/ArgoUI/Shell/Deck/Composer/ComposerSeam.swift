import ArgoEngine
import SwiftUI

/// The line above the vessel: what happened to the last send, or that the draft under it was kept.
///
/// A failed send keeps the message where it was typed (design decision 8), so this line carries
/// only the reason and the retry — never the text. Retry is a real button on the trailing edge,
/// because a remedy has to be a target.
///
/// A restored draft is simply *there*, and this line says it was kept and when. No control beside
/// it: nothing was lost and nothing needs undoing.
struct ComposerSeam: View {
    @Environment(\.argo) private var argo

    let note: ComposerSeamNote
    let retry: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            line
            // Between the line and the Retry, because it is about the line rather than a second
            // remedy. Absent wherever Argo wrote the sentence itself (§5).
            if let output = note.output {
                RawOutputDisclosure(output: output)
            }
            Spacer()
            if case .refusal = note {
                Button(action: retry) {
                    Label("Retry", systemImage: ArgoSymbol.retry)
                        .argoText(ArgoTypography.caption)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                // The tint and not a `foregroundStyle` — see `ComposerUnavailable.exit`. This
                // shipped Ion Blue where `failed.png` draws it neutral.
                .tint(argo.color.text.secondary)
            }
        }
        // Near-flush with the vessel below rather than indented to its text: the seam is a line
        // ABOUT the vessel, and one stepped in to the field's own leading reads as the first line
        // of what is in it (the study's `draft.png` and `failed.png` both).
        .padding(.horizontal, ArgoSpacing.snug)
        // `contain` and not `combine`: a combined row swallows the controls beside the sentence.
        .accessibilityElement(children: .contain)
    }

    /// The mark and the sentence, spoken as the one line they read as.
    private var line: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(symbol, .control)
                .foregroundStyle(ink)
            Text(note.detail)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(ink)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(note.detail)
    }

    /// A refusal is Argo reporting on its own failed act and takes the failure ink; a kept draft is
    /// housekeeping the reader did not ask about, and takes the quietest ink there is.
    private var ink: ArgoColor {
        switch note {
        case .refusal: argo.color.state.failure
        // A notice is the quietest of the three on purpose: what it answers is something the reader
        // just did or just asked for, and a failure ink over "this adapter does not do that" or
        // "the Turn you stopped is stopped" would read as something having gone wrong.
        case .draftKept, .notice: argo.color.text.tertiary
        }
    }

    private var symbol: String {
        switch note {
        case .refusal: ArgoSymbol.refused
        case .draftKept: ArgoSymbol.draftKept
        case .notice: ArgoSymbol.about
        }
    }
}

#Preview("Composer seam — a refused send") {
    ComposerSeam(
        note: .refusal(ComposerSeamLine(SessionDriveError.notDrivable.detail)),
        retry: {},
    )
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer seam — a drop the adapter cannot take") {
    ComposerSeam(note: .notice(ComposerSeamLine(SessionDriveError.cannotAttach.detail)), retry: {})
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer seam — what an interrupt cleared") {
    ComposerSeam(note: .notice(ComposerSeamLine(ComposerDraft.cleared)), retry: {})
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer seam — a draft that was kept") {
    ComposerSeam(note: .draftKept("Draft kept from 51m ago"), retry: {})
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
