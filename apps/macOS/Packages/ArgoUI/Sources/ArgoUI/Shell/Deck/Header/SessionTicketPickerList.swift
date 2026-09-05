import ArgoDesign
import SwiftUI

/// The picker's results (#1231): a short list at its own height, scrolling past a ceiling that
/// the backlog cannot move.
///
/// Counted rather than capped, for `ComposerMenuList`'s reason: a `ScrollView` given a
/// `maxHeight` takes all of it, so a two-row result would stand six rows tall with four rows of
/// nothing under it.
struct SessionTicketPickerList: View {
    let matches: [SessionTicketSearch.Match]
    /// Which row the keyboard cursor is on, by Ticket number. `nil` while nothing matched.
    let current: Int?
    let pick: (Int) -> Void

    var body: some View {
        if matches.isEmpty {
            SessionTicketPickerZeroLine()
        } else {
            list
        }
    }

    private var list: some View {
        ScrollViewReader { rows in
            ScrollView(.vertical) {
                LazyVStack(spacing: ArgoSpacing.flush) {
                    ForEach(matches) { match in
                        Button { pick(match.id) } label: {
                            SessionTicketPickerRow(match: match, isCurrent: match.id == current)
                        }
                        .buttonStyle(.plain)
                        .id(match.id)
                    }
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(height: height)
            // The keyboard is the whole point of the picker, so a cursor walked past the ceiling
            // has to bring its row with it — otherwise Return lands on a Ticket nobody can see.
            .onChange(of: current) { _, row in
                guard let row else { return }
                rows.scrollTo(row)
            }
        }
    }

    private var height: CGFloat {
        min(CGFloat(matches.count) * ArgoTicketPicker.rowHeight, ArgoTicketPicker.listCeiling)
    }
}
