import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One row of the sidebar: a mark, a name, what it holds, and what it could not place.
///
/// The name is set on `rowMeta` rather than `rowTitle`: a view name is chrome, and it must not
/// compete with a ticket title in the pane beside it (`cockpit-work-room.md`, token
/// reconciliation).
struct ViewRow: View {
    @Environment(\.argo) private var argo

    let symbol: String
    let name: String
    /// The glyph's ink — `TicketsView.ink`, the same value the row mark counting into this view
    /// draws in. Passed as a value rather than read off a `TicketsView` here, so this row stays a
    /// dumb view of four strings and a colour.
    var ink: ArgoColor?
    /// What the row holds, and `nil` where nothing has said enough to arrive at a number. The slot
    /// is then EMPTY rather than a zero, which is the same rule the rest of the room reads by.
    let count: Int?
    /// What the count is SHORT by, and zero where it is the whole answer (#1074).
    var unplaced = 0

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(symbol, .inline)
                .foregroundStyle((ink ?? argo.color.text.tertiary).color)
                .frame(width: ArgoTicketsSidebar.glyphWidth)
            Text(name)
                .argoText(ArgoTypography.rowMeta)
                .lineLimit(1)
            Spacer(minLength: ArgoSpacing.base)
            shortfall
            if let count {
                Text("\(count, format: .machine)")
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        }
        // NO leading padding: the row already stands on `railInset`, which the sidebar `List`
        // insets its rows' content by, and a gutter over it takes the marks off the rail.
        .frame(minHeight: ArgoTicketsSidebar.viewRowHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(announcement)
    }

    /// How many live Sessions the view's join could not place, inboard of the count so the numbers
    /// keep the trailing edge they are read down. Nothing at zero, and nothing where the count
    /// itself is absent — a shortfall off a join that never happened states no partial answer.
    @ViewBuilder private var shortfall: some View {
        if unplaced > 0, count != nil {
            // WORDED, not a glyph and a numeral: two bare numbers on one row read as two counts,
            // and what this one says — that the count beside it is short — cannot be inferred from
            // a mark. Two words and not three: `n Sessions unplaced` truncates the view NAME at
            // 280, and what could not be placed is the `help` sentence's to say.
            //
            // `text.tertiary`, the COUNT's own ink. `text.disabled` measured 1.12:1 against this
            // rail's row ground — a 3/255 step, findable only at 3× — and there is no rung between
            // the two. Subordination is carried by position and by being words beside a numeral.
            Text("\(unplaced, format: .machine) unplaced")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .fixedSize()
                .help(Self.help(unplaced))
        }
    }

    /// The whole sentence, hovered and spoken, so the reader learns what to DO about the shortfall
    /// — a branch naming its ticket is what places a Session (`docs/agents/worktrees.md`).
    private static func help(_ unplaced: Int) -> String {
        "\(unplaced) live \(unplaced == 1 ? "Session names" : "Sessions name") no ticket, so this "
            + "count is short by \(unplaced)."
    }

    private var announcement: String {
        guard let count else { return name }
        let held = "\(name), \(count)"
        return unplaced > 0 ? "\(held), \(Self.help(unplaced))" : held
    }
}

#Preview("View rows — the four backlog views, one of them short") {
    List {
        Section("Backlog") {
            ForEach(TicketsView.allCases) { view in
                ViewRow(
                    symbol: view.symbol,
                    name: view.name,
                    count: 12,
                    unplaced: view == .inProgress ? 2 : 0,
                )
            }
        }
    }
    .listStyle(.sidebar)
    .frame(width: ArgoLayout.sidebarMinimumWidth, height: 320)
    .argoAppearance()
}
