import SwiftUI

/// The states of the composer's `/` menu (#685) — the surface that opens over the vessel, drawn
/// against `docs/designs/composer-picker/`.
///
/// Each is the whole vessel with the menu over it rather than the menu alone: what these have to
/// settle is how the two surfaces read TOGETHER, and a list rendered on its own answers nothing
/// about the glass it stands on.
extension SpecimenRegistry {
    static let commands: [SpecimenEntry] = [
        // `slash.png`. The bare `/`: seventy-odd things sectioned by origin, nearest first, with
        // the sticky header naming where each group was read from. The judgement is whether the
        // graphite menu reads as a MENU over the glass vessel rather than a second vessel.
        SpecimenEntry("composerSlash") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commands,
                draft: ComposerSpecimen.commanding,
                commands: CommandCatalogFixture.machine,
            )
        },
        // `slash-filter.png`. Typed far enough to narrow it: the sections stop being origins and
        // become prefix matches then the ones that merely contain the characters, and origin moves
        // onto the rows. The claim is that the good match never slides down as the reader types.
        SpecimenEntry("composerSlashFilter") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commands,
                draft: ComposerSpecimen.commandFiltered,
                commands: CommandCatalogFixture.machine,
            )
        },
        // `slash-edge.png`. Both edges in one line: a skill whose frontmatter states no description
        // says so rather than carrying an invention, and the row standing where one of the user's
        // own would be says `shadows yours`. Neither state was imagined — the study found both.
        SpecimenEntry("composerSlashEdge") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commands,
                draft: ComposerSpecimen.commandEdge,
                commands: CommandCatalogFixture.machine,
            )
        },
        // `slash-zero.png`. Nothing matched, and the surface STAYS: `/graphify` is a fine thing to
        // say to an agent, so the line names what did not match and says the words are still just
        // text. The judgement is whether it reads as information rather than as a refusal.
        SpecimenEntry("composerSlashZero") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commands,
                draft: ComposerSpecimen.commandZero,
                commands: CommandCatalogFixture.machine,
            )
        },
        // `slash-args.png`. After a pick: the command in the field with its argument typed after
        // it, and NO menu — the space closed it. The state exists to prove the composer stayed
        // sendable throughout, which is the whole reason ⏎ inserts rather than sends.
        SpecimenEntry("composerSlashArgs") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commands,
                draft: ComposerSpecimen.commandArgs,
                commands: CommandCatalogFixture.machine,
            )
        },
        // `running.png` and `queued.png`, decision 17: the menu opens over a Turn in flight exactly
        // as it does at rest, and coexists with a follow-up already waiting. Two surfaces stacked
        // over the field is the state — whether that reads as one vessel or as three is the
        // judgement, and only this render settles it.
        SpecimenEntry("composerSlashRunning") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commandsRunning,
                draft: ComposerSpecimen.commandQueued,
                commands: CommandCatalogFixture.machine,
            )
        },
        // `slash-late.png`, decision 9. The seconds after a window opens: every skill is already
        // listed and the CLI's own half is still being asked for, said in a strip PINNED above the
        // list. Drawn in its section's place it would sit below ten rows where nobody sees it.
        SpecimenEntry("composerSlashLate") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commands,
                draft: ComposerSpecimen.commanding,
                commands: CommandCatalogFixture.reading,
            )
        },
        // `slash-fail.png`, decision 10. The read failed: the skills stand, the built-in half is
        // honestly empty, and the line says both that and the way round it. The judgement is
        // whether it reads as a fact about the list rather than as an error the reader caused.
        SpecimenEntry("composerSlashFail") {
            ComposerSpecimen(
                composer: ComposerSpecimen.commands,
                draft: ComposerSpecimen.commanding,
                commands: CommandCatalogFixture.unavailable,
            )
        },
        // `codex.png`'s claim, at the vessel: an adapter that declares no command surface draws no
        // menu at all for a line that would open one everywhere else. Absent, never disabled.
        SpecimenEntry("composerSlashAbsent") {
            ComposerSpecimen(
                composer: ComposerSpecimen.composer,
                draft: ComposerSpecimen.commanding,
                commands: CommandCatalogFixture.machine,
            )
        },
    ]
}
