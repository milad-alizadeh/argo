import SwiftUI

/// The states of the composer's `@` menu (#687) — the file picker that opens over the vessel,
/// drawn against `docs/designs/composer-picker/`.
///
/// Each is the whole vessel with the menu over it, for the reason the `/` cases are: what these
/// settle is how the graphite list reads against the glass it stands on.
extension SpecimenRegistry {
    static let mentions: [SpecimenEntry] = [
        // `at.png`. The bare `@` mid-sentence: the whole Workspace, the three files this Session
        // has been in at the top wearing their mark, eleven rows drawn and the rest scrolling. The
        // judgement is whether a column of nine-segment paths is readable with the FILENAME
        // leading — which is the one thing the design changed about this row.
        SpecimenEntry("composerAt") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentioning,
                files: WorkspaceFileFixture.machine,
            )
        },
        // `at-filter.png`, decision 13. Six keystrokes into a nine-segment path, matched as a
        // subsequence over the whole of it. No accent inking here, unlike the `/` menu: the
        // matched characters are scattered across the segments, and inking them speckles the row.
        SpecimenEntry("composerAtFilter") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentionFiltered,
                files: WorkspaceFileFixture.machine,
            )
        },
        // `at-inserted.png`, decision 12. After a pick: the whole path in the line as TEXT, the
        // sentence carried on after it, and no menu. It is deliberately NOT an `AttachmentChip` —
        // dropping and pasting make chips (#540), a different act with a different result — and
        // this render is the only thing that settles whether a bare path reads as a mention.
        SpecimenEntry("composerAtInserted") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentionInserted,
                files: WorkspaceFileFixture.machine,
            )
        },
        // No render: nothing in the tree matches. The surface stays and the line stays sendable,
        // exactly as the `/` menu's zero state does. Its own case because the happy path never
        // draws it.
        SpecimenEntry("composerAtZero") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentions,
                draft: ComposerSpecimen.mentionZero,
                files: WorkspaceFileFixture.machine,
            )
        },
        // `codex.png`'s other half, decision 14. The same Session that draws NO `/` menu draws the
        // file menu, because Argo does that expansion itself. `composerSlashAbsent` is the same
        // adapter on a `/` line and must stay bare — the pair is the claim.
        SpecimenEntry("composerAtNoCommands") {
            ComposerSpecimen(
                composer: ComposerSpecimen.mentionsNoCommands,
                draft: ComposerSpecimen.mentioning,
                files: WorkspaceFileFixture.machine,
            )
        },
    ]
}
