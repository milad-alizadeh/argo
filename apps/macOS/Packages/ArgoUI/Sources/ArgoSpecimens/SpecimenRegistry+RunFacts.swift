import ArgoUI
import SwiftUI

/// The states of what a Session RUNS AT — the fact line on the footer and the popover it opens
/// (#558), drawn against `docs/designs/composer/run.png` and `rest.png`.
///
/// Six cases and not one per combination: what each is about is a rule, and the rules are the
/// trigger's two inks, the two read-backs that must survive verbatim, an adapter that declares one
/// knob, and one that declares neither.
extension SpecimenRegistry {
    static let runFacts: [SpecimenEntry] = [
        // `rest.png`. The closed state at the defaults — chromeless, quiet, `Opus 5 · Medium`.
        SpecimenEntry("composerRunFacts") {
            ComposerSpecimen(composer: ComposerSpecimen.composer)
        },
        // The other closed state: off the defaults, where the line BRIGHTENS. It is the whole of
        // what the trigger's two inks are for, so the pair is rendered rather than described.
        SpecimenEntry("composerRunFactsChanged") {
            ComposerSpecimen(composer: ComposerSpecimen.runFactsChanged)
        },
        // `run.png`. The popover open at the defaults: three model rows with the first ticked, five
        // effort stops with Medium held, and the reset INERT — it names values already in force.
        SpecimenEntry("composerRunSettings") {
            ComposerSpecimen(composer: ComposerSpecimen.composer, opening: .runSettings)
        },
        // The same popover with the reset live, naming all three of what it restores.
        SpecimenEntry("composerRunSettingsChanged") {
            ComposerSpecimen(
                composer: ComposerSpecimen.runFactsChanged,
                opening: .runSettings,
            )
        },
        // Acceptance criterion 2, rendered: a model id off Argo's table gets a row of its own so
        // the tick has somewhere to land, and a level off the ladder ticks no segment at all.
        SpecimenEntry("composerRunSettingsUnread") {
            ComposerSpecimen(
                composer: ComposerSpecimen.runFactsUnread,
                opening: .runSettings,
            )
        },
        // Criterion 4: an adapter declaring one knob draws that section ALONE. The Model section is
        // absent, not greyed — the same rule `composerPlusFilesOnly` renders for `AddMenu`.
        SpecimenEntry("composerRunSettingsEffortOnly") {
            ComposerSpecimen(
                composer: ComposerSpecimen.runFactsEffortOnly,
                opening: .runSettings,
            )
        },
        // And the limit of that rule: an adapter declaring NEITHER draws no trigger at all, so the
        // facts are words on the footer with nothing behind them.
        SpecimenEntry("composerRunFactsUnopenable") {
            ComposerSpecimen(composer: ComposerSpecimen.mentionsNoCommands)
        },
    ]
}
