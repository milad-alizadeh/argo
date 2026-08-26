import SwiftUI

/// The surface the composer's `@` opens: every file in the Session's Workspace, the ones its agent
/// has been in first, filtering as the reader types (#687, `cockpit-composer-picker.md`).
///
/// It wears `CommandMenu`'s plane and shares nothing else. There are no sections and no status
/// strip, because one clock reads the tree and every path came off it — where the `/` menu joins
/// two halves with two clocks and has to say so.
struct FileMenu: View {
    let menu: WorkspaceFileProjection.Menu
    /// Which row the keyboard cursor is on, by path. `nil` while the list is empty.
    let current: String?
    let pick: (WorkspaceFileProjection.Row) -> Void

    var body: some View {
        list
            .argoComposerMenu(labelled: Self.label)
    }

    /// Counted rather than capped, for the reason `CommandMenu`'s is: a `ScrollView` given a
    /// `maxHeight` takes all of it, so a two-file menu would stand eleven rows tall.
    @ViewBuilder private var list: some View {
        if menu.isEmpty {
            FileMenuEmpty(query: menu.query)
        } else {
            ScrollView(.vertical) {
                LazyVStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                    ForEach(menu.rows) { row in
                        Button { pick(row) } label: {
                            FileMenuRow(row: row, isCurrent: row.path == current)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(height: listHeight)
        }
    }

    /// The same ceiling the `/` menu takes, which over a list with no headers in it is eleven rows
    /// and the top of a twelfth — what `at.png` draws.
    private var listHeight: CGFloat {
        min(
            CGFloat(menu.rows.count) * ArgoComposerVessel.commandRowHeight,
            ArgoComposerVessel.commandListCeiling,
        )
    }

    static let label = "Files in this Workspace"
}
