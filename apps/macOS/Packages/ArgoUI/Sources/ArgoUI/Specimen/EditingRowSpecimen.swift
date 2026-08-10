import SwiftUI

/// The roster with one row being typed into, its neighbours at rest.
///
/// The one state edit-in-place has that no value test can see: whether a field standing where a
/// title was still reads as one row of a list — inside the sidebar's own selection capsule, at the
/// row's own type size — rather than as a box dropped on top of the roster. The rows either side
/// are at rest deliberately: a picture of a single editing row could not show that.
///
/// It drives the SHIPPING row through the same binding the sidebar drives it with, so the PNG is
/// evidence about what a double-click actually opens rather than about a field a specimen drew.
struct EditingRowSpecimen: View {
    /// Seeded open, because the field is otherwise reached by a double-click and no package test
    /// can click. The `String?` and not a `Bool` for the shell's own reason: at most one row.
    @State private var renamingRowID: String? = RenameFixture.editingRowID

    var body: some View {
        List {
            ForEach(RenameFixture.rows) { row in
                SessionRow(
                    row: row,
                    isRenaming: Binding(
                        get: { renamingRowID == row.id },
                        set: { renamingRowID = $0 ? row.id : nil },
                    ),
                )
                .previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }
}

#Preview("Editing row — one row mid-rename, two at rest") {
    EditingRowSpecimen()
        .frame(height: 240)
        .argoAppearance()
}
