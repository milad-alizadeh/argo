import ArgoEngine
import SwiftUI

/// The line above the vessel: what happened to the last send, or that the draft under it was kept.
///
/// A failed send keeps the message where it was typed (design decision 8), so this line carries
/// only the reason and the retry — never the text, and never a toast that would leave with the
/// answer still unknown. Retry is a real button on the trailing edge rather than a link trailing
/// the sentence: it is the remedy, and a remedy has to be a target.
///
/// A restored draft is simply *there*, and this line says it was kept and when. No control beside
/// it: nothing was lost and nothing needs undoing, so an offer to restore or discard would invent
/// a decision out of a state that is already correct.
struct ComposerSeam: View {
    @Environment(\.argo) private var argo

    let note: ComposerSeamNote
    let retry: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(symbol, .control)
                .foregroundStyle(ink)
            Text(note.detail)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(ink)
            Spacer()
            if case .refusal = note {
                Button(action: retry) {
                    Label("Retry", systemImage: ArgoSymbol.retry)
                        .argoText(ArgoTypography.caption)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        // Near-flush with the vessel below rather than indented to its text: the seam is a line
        // ABOUT the vessel, and one stepped in to the field's own leading reads as the first line
        // of what is in it (the study's `draft.png` and `failed.png` both).
        .padding(.horizontal, ArgoSpacing.snug)
        .accessibilityElement(children: .combine)
    }

    /// A refusal is Argo reporting on its own failed act and takes the failure ink; a kept draft is
    /// housekeeping the reader did not ask about, and takes the quietest ink there is. The whole
    /// difference between the two notes is how loudly they are allowed to speak.
    private var ink: ArgoColor {
        switch note {
        case .refusal: argo.color.state.failure
        // A capability notice is the quietest of the three on purpose: the drop it answers changed
        // nothing, and a failure ink over "this adapter does not do that" would read as something
        // having gone wrong with the Session.
        case .draftKept, .capability: argo.color.text.tertiary
        }
    }

    private var symbol: String {
        switch note {
        case .refusal: ArgoSymbol.refused
        case .draftKept: ArgoSymbol.draftKept
        case .capability: ArgoSymbol.about
        }
    }
}

#Preview("Composer seam — a refused send") {
    ComposerSeam(
        note: .refusal("Argo no longer holds this Session — nothing was sent"),
        retry: {},
    )
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer seam — a drop the adapter cannot take") {
    ComposerSeam(note: .capability(SessionDriveError.cannotAttach.detail), retry: {})
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
