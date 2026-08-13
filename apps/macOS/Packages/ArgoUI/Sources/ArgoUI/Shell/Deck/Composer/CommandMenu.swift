import SwiftUI

/// The surface the composer's `/` opens: every skill installed for this Project, sectioned by where
/// it came from, filtering as the reader types (#685, `cockpit-composer-picker.md`).
///
/// **A menu, not glass.** No `.glassEffect` and no `GlassEffectContainer`: D14 rations glass away
/// from a surface that hangs off the field, and the vessel below is already glass — a second layer
/// over it is the stacking Apple's own guidance asks you to avoid.
///
/// **It takes no width.** It gets the vessel's, because the description is the content: at any
/// stated width two thirds of a real `description:` is an ellipsis.
///
/// Not a `.popover` either, though the platform has one. A popover draws an arrow, brings its own
/// material and takes key focus — and the caret has to stay in the field, because every keystroke
/// after the `/` is still going into the draft.
struct CommandMenu: View {
    @Environment(\.argo) private var argo

    let menu: CommandMenuProjection.Menu
    /// Which row the keyboard cursor is on, by command. `nil` while the list is empty.
    let marked: String?
    let pick: (CommandMenuProjection.Row) -> Void

    var body: some View {
        list
            .padding(ArgoSpacing.tight)
            .background(.regularMaterial, in: surface)
            .overlay { rim }
            .argoShadow(.popover)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(Self.label)
    }

    private var surface: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.popover)
    }

    /// The restrained edge D14 allows a menu, and the only thing separating it from the glass
    /// vessel it stands over.
    private var rim: some View {
        surface.strokeBorder(argo.color.edge.glassRim, lineWidth: ArgoStroke.border)
    }

    /// Scrolls past its ceiling and is drawn at its own height under it, so a two-row list is two
    /// rows tall rather than a mostly-empty panel.
    @ViewBuilder private var list: some View {
        if menu.isEmpty {
            CommandMenuEmpty(query: menu.query)
        } else {
            ScrollView(.vertical) {
                LazyVStack(
                    alignment: .leading,
                    spacing: ArgoSpacing.flush,
                    pinnedViews: .sectionHeaders,
                ) {
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

    /// What the list actually stands at: its own content, up to the ceiling. COUNTED rather than
    /// left to the scroll view, which is greedy — given a ceiling it takes all of it, and a
    /// two-row menu came out ten rows tall with eight rows of nothing under it.
    ///
    /// Countable because every part of the list has a stated height. That is what those two
    /// derivations in `ArgoComposerVessel` are for.
    private var listHeight: CGFloat {
        let rows = CGFloat(menu.rows.count) * ArgoComposerVessel.commandRowHeight
        let headers = CGFloat(menu.sections.count { $0.label != nil })
            * ArgoComposerVessel.commandSectionHeight
        return min(rows + headers, ArgoComposerVessel.commandListCeiling)
    }

    private func rows(of section: CommandMenuProjection.Section) -> some View {
        ForEach(section.rows) { row in
            Button { pick(row) } label: {
                CommandMenuRow(row: row, isMarked: row.command == marked)
            }
            .buttonStyle(.plain)
        }
    }

    /// Sticky, so the origin the reader is scrolling through stays named. The prefix-match group
    /// has no header at all, which is why this can draw nothing.
    @ViewBuilder private func header(of section: CommandMenuProjection.Section) -> some View {
        if let label = section.label {
            CommandMenuSection(label: label, detail: section.detail)
                .background(.regularMaterial)
        }
    }

    static let label = "Skills and commands"
}
