import ArgoDesign

/// What `AddMenu` lists, and in what order (design decision 11, `cockpit-composer-picker.md`,
/// #689).
///
/// A plain extension on `ComposerMenu` rather than a member of the `AddMenu` view: `ComposerMenus`
/// reads `addRows(on:)` from a non-isolated context, the way it already reads `commands(for:in:)`
/// and `files(for:in:touched:)` — putting the derive on the View would have coloured every caller
/// `@MainActor` for no reason a View's own isolation should ever force on a value type.
extension ComposerMenu {
    /// One row of `AddMenu`: what it opens, its icon and its shortcut key both DERIVED off the same
    /// `sigil` — `plus.png` draws one mark per row, unlike `CommandMenuRow` and `FileMenuRow`,
    /// which carry none. One source rather than three redundant stored ones is also what keeps this
    /// under edge 6's 4-parameter cap.
    struct AddRow: Equatable, Identifiable {
        let id: String
        let label: String
        let sigil: Sigil

        /// The shortcut that opens the same thing directly — `Sigil.mark` already IS this
        /// character, so a second stored one could only ever drift from it.
        var key: Character {
            sigil.mark
        }

        var icon: String {
            sigil == .file ? ArgoSymbol.addMenuFiles : ArgoSymbol.addMenuCommands
        }
    }

    /// Files first, then commands — the design's own order, and the one `plus.png` draws. Static
    /// and unfiltered: `AddMenu` does not filter its own two rows, it OPENS the full listing
    /// picking one of them does (`ComposerMenus.addMenuPicked(_:)`).
    static func addRows(on line: ComposerMenuLine) -> [AddRow] {
        var rows: [AddRow] = []
        if line.workspaceRoot != nil {
            rows.append(AddRow(id: "files", label: "Files in this Workspace", sigil: .file))
        }
        if line.canRunCommands {
            rows.append(AddRow(id: "commands", label: "Skills & commands", sigil: .command))
        }
        return rows
    }
}
