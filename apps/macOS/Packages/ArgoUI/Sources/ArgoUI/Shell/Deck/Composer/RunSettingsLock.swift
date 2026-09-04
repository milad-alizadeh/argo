import ArgoAtoms
import ArgoDesign
import SwiftUI

/// What the run-settings popover says while a Turn is running, and what it does to the two
/// sections under it (#1217).
///
/// The CLI takes Model and Effort as lines typed at its own prompt, and a line typed mid-Turn is
/// QUEUED as the next prompt rather than run — so the port refuses both knobs until the Turn ends
/// (`SessionDriveError.runFactsBusy`). That refusal was already true before this; what was missing
/// was any sign of it. A reader clicked `Sonnet 5`, the row did not tick, and the sentence the
/// refusal put on the composer's seam was behind the popover still open over it.
///
/// **Inert with the reason ON it, rather than absent.** A knob the adapter does not declare is left
/// OUT of the popover (#558, criterion 4), because that section can never work and a greyed control
/// gives no reason. This one works again in a moment, and naming the moment is the whole
/// affordance.
struct RunSettingsLock: View {
    @Environment(\.argo) private var argo

    /// The port's own sentence, passed through untouched — see `RunFactsControl.lockWords`.
    let words: String

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            // The wait, not a warning: nothing has failed here, and the knobs come back by
            // themselves. It is the mark a draft held for later already wears.
            ArgoGlyph(ArgoSymbol.draftKept, .inline)
            Text(words).argoText(ArgoTypography.caption)
        }
        .foregroundStyle(argo.color.text.secondary)
        // Or the sentence takes only its own width and the row's remainder reads as a gap.
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

extension View {
    /// A whole section that is live again in a moment, drawn as one that cannot be driven now
    /// (#1217).
    ///
    /// Both halves together and never one alone: `disabled` by itself leaves rows that look
    /// clickable and are not, and the opacity by itself leaves rows that take a click nothing can
    /// honour. `ghosted` is the contract's own rung for a surface the reader cannot drive.
    ///
    /// For a SECTION, never a control that already draws its own inert state — see the reset in
    /// `RunSettingsPopover`, which changes ink instead. Two dims stacked on one control say the
    /// same thing twice at two strengths.
    func runSettingsInert(_ isInert: Bool) -> some View {
        disabled(isInert).opacity(isInert ? ArgoOpacity.ghosted : ArgoOpacity.full)
    }
}

// The state the ticket is about, rendered: the two sections ghosted, the reset with them, and one
// sentence saying when they come back.
#Preview("Run settings — locked while a Turn is running") {
    RunSettingsPopover(
        control: RunFactsControl(
            facts: bothKnobs("claude-opus-5", .exactly(.medium, cli: "medium")),
            takesTypedLine: false,
        ),
        mode: .exactly(.code, cli: "acceptEdits"),
    )
    .argoAppearance()
}
