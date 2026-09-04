import ArgoAtoms
import ArgoDesign
import SwiftUI

/// What the run-settings popover says while it holds a Model or an Effort rung for the Turn's end
/// (#1329, formerly #1217).
///
/// The CLI takes Model and Effort as lines typed at its own prompt, and a line typed mid-Turn is
/// QUEUED as the next prompt rather than run — so the port refuses both knobs until the Turn ends
/// (`SessionDriveError.runFactsBusy`). Argo used to leave the two sections GHOSTED under that
/// refusal, with a sentence naming why the click did nothing (#1217). It Held the pick instead: a
/// reader who clicks `Sonnet 5` mid-Turn sees the row taken and carried to the boundary, and this
/// line NAMES what is held rather than why a click failed — see `RunFactsControl.lockWords`.
struct RunSettingsLock: View {
    @Environment(\.argo) private var argo

    /// What is held, and until when — see `RunFactsControl.lockWords`.
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

// The state #1329 replaced: see "Run settings — a Model held until the Turn ends" in
// `RunSettingsPopover.swift`, where the two sections stay live rather than ghosted.
#Preview("Run settings lock — an Effort held until the Turn ends") {
    RunSettingsLock(words: RunFactsControl(
        facts: bothKnobs("claude-opus-5", .exactly(.medium, cli: "medium")),
        held: RunFactsHeld(effort: .xhigh),
    ).lockWords ?? "")
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
