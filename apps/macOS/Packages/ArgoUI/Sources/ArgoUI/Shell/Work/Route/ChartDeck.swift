import SwiftUI

/// The deck scoped to one chart: a head carrying `Present as: Tree | Map`, and under it the
/// parent's children as a tree or as the Route (#334, #335).
///
/// It replaces BOTH deck panes and carries its own head, which is why the room's toolbar empties
/// for it (`cockpit-work-room.md`). An opaque Work-room surface — not glass, not a card.
///
/// The head is the whole of the chrome #335 lands. Zoom, a Fit action, a frontier readout, the
/// legend and clicking a dot into the detail pane are #339's and #340's, and the head is where they
/// arrive.
struct ChartDeck: View {
    @Environment(\.argo) private var argo

    let chart: WorkRoomProjection.ChartScope
    /// How this parent is presented. `map` cannot be reached at all where the chart has no Route,
    /// so the control is absent rather than offering a presentation with nothing behind it.
    @Binding var presentation: WorkPresentation
    /// The `Tree` half, built by the room rather than here: the fold and the selection it holds are
    /// the room's, and threading two more bindings through this head to reach them would make the
    /// head a conduit for state it never reads.
    let tree: ScopedTree

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            head
            ArgoRule(ink: argo.color.edge.hairline)
            presented
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var head: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            Text("Work · #\(chart.parent)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
            Text(chart.title)
                .argoText(ArgoTypography.windowTitle)
                .foregroundStyle(argo.color.text.primary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: ArgoSpacing.comfortable)
            if chart.route != nil {
                RoomPresentation(presentation: $presentation)
            }
        }
        .padding(ArgoRoute.headPadding)
    }

    /// The Route only where there IS one and the reader asked for it. A chart whose children the
    /// poll has not reached falls back to the tree rather than to an empty canvas — an axis with
    /// nothing on it reads as finished work, which is the one thing it must never say.
    @ViewBuilder private var presented: some View {
        if let route = chart.route, presentation == .map {
            RouteCanvas(route: route)
        } else {
            tree
        }
    }
}

#Preview("Chart deck — both presentations of one chart") {
    @Previewable @State var presentation = WorkPresentation.map
    @Previewable @State var selection: Int? = 334
    @Previewable @State var shut: Set<Int> = []
    let room = WorkFixture.chartRoom

    if let chart = room.chart {
        ChartDeck(
            chart: chart,
            presentation: $presentation,
            tree: ScopedTree(rows: room.backlog, selection: $selection, shut: $shut),
        )
        .frame(width: 1100, height: 560)
        .argoDeckSurface()
        .argoAppearance()
    }
}
