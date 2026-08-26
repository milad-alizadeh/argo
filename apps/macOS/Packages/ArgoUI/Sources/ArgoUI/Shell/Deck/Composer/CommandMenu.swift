import SwiftUI

/// The surface the composer's `/` opens: every skill installed for this Project, sectioned by where
/// it came from, filtering as the reader types (#685, `cockpit-composer-picker.md`).
///
/// Not a `.popover`, though the platform has one: a popover takes key focus, and the caret has to
/// stay in the field because every keystroke after the `/` is still going into the draft.
struct CommandMenu: View {
    let menu: CommandMenuProjection.Menu
    /// Which row the keyboard cursor is on, by command. `nil` while the list is empty.
    let marked: String?
    let pick: (CommandMenuProjection.Row) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            // Above the list and outside the scroll: the state of the slower half must not scroll
            // away under ten rows of the faster one (design decision 9).
            CommandMenuStatus(builtins: menu.builtins)
            list
        }
        .argoComposerMenu(labelled: Self.label)
    }

    /// Scrolls past its ceiling and is drawn at its own height under it, so a two-row list is two
    /// rows tall rather than a mostly-empty panel.
    @ViewBuilder private var list: some View {
        if menu.isEmpty {
            CommandMenuEmpty(query: menu.query)
        } else {
            ScrollView(.vertical) {
                // Headers scroll with their group rather than pinning to the top edge. A pinned one
                // needs a ground of its own to stop rows showing through it, and that band is
                // exactly what the design no longer draws.
                LazyVStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                    ForEach(menu.sections) { section in
                        Section {
                            rows(of: section)
                        } header: {
                            header(of: section)
                        }
                    }
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(height: listHeight)
        }
    }

    /// Counted rather than capped: a `ScrollView` given a `maxHeight` takes all of it, so a two-row
    /// menu would stand ten rows tall with eight rows of nothing under it.
    private var listHeight: CGFloat {
        let rows = CGFloat(menu.rows.count) * ArgoComposerVessel.commandRowHeight
        let headers = CGFloat(menu.sections.count { $0.label != nil })
            * ArgoComposerVessel.commandSectionHeight
        // The first header separates nothing, so it stands shorter than the rest by the difference
        // between the separating gap and the row inset it takes instead.
        let shorterBy = ArgoSpacing.comfortable - ArgoSpacing.snug
        let unseparated = menu.sections.first?.label == nil ? 0 : shorterBy
        return min(rows + headers - unseparated, ArgoComposerVessel.commandListCeiling)
    }

    private func rows(of section: CommandMenuProjection.Section) -> some View {
        ForEach(section.rows) { row in
            Button { pick(row) } label: {
                CommandMenuRow(row: row, isMarked: row.command == marked)
            }
            .buttonStyle(.plain)
        }
    }

    /// The prefix-match group has no header at all, which is why this can draw nothing.
    @ViewBuilder private func header(of section: CommandMenuProjection.Section) -> some View {
        if let label = section.label {
            CommandMenuSection(
                label: label,
                detail: section.detail,
                separates: section.id != menu.sections.first?.id,
            )
        }
    }

    static let label = "Skills and commands"
}
