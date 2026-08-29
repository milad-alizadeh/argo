import SwiftUI

/// The surface a composer sigil opens: a status strip where there is one, then the rows, sectioned
/// where the sigil groups them, filtering as the reader types (#685, #687).
///
/// Not a `.popover`, though the platform has one: a popover takes key focus, and the caret has to
/// stay in the field because every keystroke after the sigil is still going into the draft.
struct ComposerMenuList: View {
    let listing: ComposerMenu.Listing
    /// Which row the keyboard cursor is on, by id. `nil` while the list is empty.
    let current: String?
    let pick: (ComposerMenu.Row) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            // Above the list and outside the scroll: the state of a slower half must not scroll
            // away under ten rows of the faster one (design decision 9).
            if let status = listing.status {
                ComposerMenuStatusLine(status: status)
            }
            list
        }
        .argoComposerMenu(labelled: listing.sigil.label)
    }

    /// Scrolls past its ceiling and is drawn at its own height under it, so a two-row list is two
    /// rows tall rather than a mostly-empty panel.
    @ViewBuilder private var list: some View {
        if listing.isReading {
            // The status strip above is the whole surface. Nothing is said about what matched,
            // because nothing has been looked in yet.
            EmptyView()
        } else if listing.isEmpty {
            ComposerMenuZeroLine(query: listing.query, sigil: listing.sigil)
        } else {
            ScrollView(.vertical) {
                // Headers scroll with their group rather than pinning to the top edge. A pinned one
                // needs a ground of its own to stop rows showing through it, and that band is
                // exactly what the design no longer draws.
                LazyVStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                    ForEach(listing.sections) { section in
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
        let rows = CGFloat(listing.rows.count) * ArgoComposerVessel.commandRowHeight
        let headers = CGFloat(listing.sections.count { $0.label != nil })
            * ArgoComposerVessel.commandSectionHeight
        // The first header separates nothing, so it stands shorter than the rest by the difference
        // between the separating gap and the row inset it takes instead.
        let shorterBy = ArgoSpacing.comfortable - ArgoSpacing.snug
        let unseparated = listing.sections.first?.label == nil ? 0 : shorterBy
        return min(rows + headers - unseparated, ArgoComposerVessel.commandListCeiling)
    }

    private func rows(of section: ComposerMenu.Section) -> some View {
        ForEach(section.rows) { row in
            Button { pick(row) } label: {
                ComposerMenuRow(row: row, isCurrent: row.id == current)
            }
            .buttonStyle(.plain)
        }
    }

    /// An unlabelled section has no header at all, which is why this can draw nothing.
    @ViewBuilder private func header(of section: ComposerMenu.Section) -> some View {
        if let label = section.label {
            ComposerMenuSection(
                label: label,
                detail: section.detail,
                separates: section.id != listing.sections.first?.id,
            )
        }
    }
}
