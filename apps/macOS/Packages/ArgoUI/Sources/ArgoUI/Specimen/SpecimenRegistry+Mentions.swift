import SwiftUI

/// The states of the composer's `@` menu (#687), drawn against `docs/designs/composer-picker/`.
/// Each is the whole vessel with the menu over it: what they settle is how the graphite list reads
/// against the glass it stands on.
extension SpecimenRegistry {
    static let mentions: [SpecimenEntry] = [
        // `at.png`. The bare `@` mid-sentence: touched files first, eleven rows drawn, rest
        // scrolls.
        SpecimenEntry("composerAt") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentioning,
                files: WorkspaceFileFixture.machine,
            )
        },
        // `at-filter.png`, decision 13. Six keystrokes matched as a subsequence over the whole
        // path, and no accent inking on what matched.
        SpecimenEntry("composerAtFilter") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentionFiltered,
                files: WorkspaceFileFixture.machine,
            )
        },
        // `at-inserted.png`, decision 12. After a pick: the path in the line as TEXT, and no menu.
        SpecimenEntry("composerAtInserted") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentionInserted,
                files: WorkspaceFileFixture.machine,
            )
        },
        // No render: nothing matches. The surface stays and the line stays sendable, as `/` does.
        SpecimenEntry("composerAtZero") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentionZero,
                files: WorkspaceFileFixture.machine,
            )
        },
        // No render: the design was drawn against paths that fit, so none of its states shows the
        // directory's left cut. Its own case because it is the row's most distinctive rule and the
        // easiest to build backwards — a leading ellipsis and a whole filename, never the reverse.
        SpecimenEntry("composerAtDeep") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentioning,
                files: WorkspaceFileFixture.deep,
            )
        },
        // `codex.png`'s other half, decision 14. A Session that draws NO `/` menu still draws this
        // one. Paired with `composerSlashAbsent`, the same adapter on a `/` line, which stays bare.
        SpecimenEntry("composerAtNoCommands") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentionsNoCommands,
                draft: ComposerSpecimen.mentioning,
                files: WorkspaceFileFixture.machine,
            )
        },
    ]
}
