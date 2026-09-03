import ArgoDesign
import SwiftUI

/// The two-row drawer `AddButton` opens: files, and skills & commands (design decision 11,
/// `cockpit-composer-picker.md`, #689).
///
/// Static and unfiltered by design — picking a row does not attach or insert anything itself, it
/// OPENS the same full listing typing `/` or `@` would (`ComposerMenus.addMenuPicked(_:)`), off
/// the one catalog or Workspace tree both sigils already read. `+` buys discovery, not a third
/// listing of its own. The rows themselves are `ComposerMenu.addRows(on:)` — see that extension
/// for why the derive lives off this View rather than on it.
///
/// No stated width, unlike its two children: it hugs its longest row, the way the Mode control
/// hugs its selected rung, rather than the vessel's own width the way a filtering catalogue needs.
struct AddMenu: View {
    let rows: [ComposerMenu.AddRow]
    /// Which row the keyboard cursor is on, by id. `nil` while there is nothing to be on — never
    /// true of a menu actually drawn, since `AddButton` renders only where `addRows(on:)` is not
    /// empty.
    let current: String?
    let pick: (ComposerMenu.AddRow) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(rows) { row in
                Button { pick(row) } label: {
                    AddMenuRow(row: row, isCurrent: row.id == current)
                }
                .buttonStyle(.plain)
            }
        }
        // Ignores the width the vessel's stack would otherwise offer it — see the type's own
        // doc comment. `ComposerMenuList`'s rows take that width on purpose; these hug it instead.
        .fixedSize(horizontal: true, vertical: false)
        .argoComposerMenu(labelled: Self.label)
    }

    /// What a screen reader calls the surface, and `AddButton`'s own tooltip — the same sentence,
    /// because the control and what it opens say one thing.
    static let label = "Add to this turn"
}

private let filesRow = ComposerMenu.AddRow(
    id: "files",
    label: "Files in this Workspace",
    sigil: .file,
)

private let commandsRow = ComposerMenu.AddRow(
    id: "commands",
    label: "Skills & commands",
    sigil: .command,
)

#Preview("Add menu") {
    AddMenu(rows: [filesRow, commandsRow], current: nil, pick: { _ in })
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Add menu — keyboard cursor on the first row") {
    AddMenu(rows: [filesRow, commandsRow], current: filesRow.id, pick: { _ in })
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Add menu — a Session offering only commands") {
    AddMenu(rows: [commandsRow], current: nil, pick: { _ in })
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
