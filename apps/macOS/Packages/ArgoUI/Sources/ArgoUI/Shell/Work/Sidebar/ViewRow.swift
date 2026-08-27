import SwiftUI

/// One row of the sidebar: a mark, a name, and what it holds. It serves BOTH groups — a `BACKLOG`
/// view and a `CHARTS` parent are the same shape, and the second group is what proved it.
///
/// The name is set on `rowMeta` rather than `rowTitle`: a view name is chrome, and it must not
/// compete with a ticket title in the pane beside it (`cockpit-work-room.md`, token
/// reconciliation).
struct ViewRow: View {
    @Environment(\.argo) private var argo

    let symbol: String
    let name: String
    /// What the row holds, and `nil` where nothing has said enough to arrive at a number. The slot
    /// is then EMPTY rather than a zero, which is the same rule the rest of the room reads by.
    let count: Int?

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(symbol, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoWorkSidebar.glyphWidth)
            Text(name)
                .argoText(ArgoTypography.rowMeta)
                .lineLimit(1)
            Spacer(minLength: ArgoSpacing.base)
            if let count {
                Text("\(count)")
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        }
        .padding(.leading, ArgoWorkSidebar.gutter)
        .frame(minHeight: ArgoWorkSidebar.viewRowHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(count.map { "\(name), \($0)" } ?? name)
    }
}

#Preview("View rows — the four backlog views and a chart") {
    List {
        Section("Backlog") {
            ForEach(WorkView.allCases) { view in
                ViewRow(symbol: view.symbol, name: view.name, count: 12)
            }
        }
        Section("Charts") {
            ViewRow(symbol: ArgoSymbol.workRoom, name: "#607 Wayfinder", count: 5)
        }
    }
    .listStyle(.sidebar)
    .frame(width: ArgoLayout.sidebarMinimumWidth, height: 320)
    .argoAppearance()
}
