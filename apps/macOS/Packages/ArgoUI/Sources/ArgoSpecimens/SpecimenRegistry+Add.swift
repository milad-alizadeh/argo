import ArgoUI
import SwiftUI

/// The states of the composer's `+` drawer (design decision 11, `cockpit-composer-picker.md`,
/// #689), drawn against `docs/designs/composer-picker/`.
///
/// `composerPlusFiles` and `composerPlusCommands` draw the SAME `ComposerMenuList` the bare `@`
/// and `/` cases in `SpecimenRegistry+Mentions.swift` and `SpecimenRegistry+Commands.swift`
/// already cover pixel-for-pixel — `AddMenu`'s row opens the identical listing typing the sigil
/// would (`ComposerMenus.addMenuPicked(_:)`), off an empty query either way. Their own cases exist
/// for the ONE thing that differs and is invisible to the eye: a pick off them drops nothing,
/// where a typed sigil's pick drops the sigil and whatever followed it — see `AddMenuTests`.
extension SpecimenRegistry {
    static let add: [SpecimenEntry] = [
        // `plus.png`. The two-row drawer itself, hugging its longest row above the vessel.
        SpecimenEntry("composerPlus") {
            ComposerSpecimen(composer: ComposerSpecimen.mentions, opening: .addMenu)
        },
        // `plus-files.png`'s claim at the vessel: picking Files opens the SAME file listing `@`
        // does.
        SpecimenEntry("composerPlusFiles") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                files: WorkspaceFileFixture.machine,
                opening: .files,
            )
        },
        // The Skills & commands row's own opening — the same catalogue `/` draws.
        SpecimenEntry("composerPlusCommands") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                commands: CommandCatalogFixture.machine,
                opening: .commands,
            )
        },
        // A Session offering neither a Workspace nor a command surface draws no `+` at all —
        // absent, never disabled (design decision 9 read for this control).
        SpecimenEntry("composerPlusAbsent") {
            ComposerSpecimen(composer: ComposerSpecimen.noAttach)
        },
    ]
}
