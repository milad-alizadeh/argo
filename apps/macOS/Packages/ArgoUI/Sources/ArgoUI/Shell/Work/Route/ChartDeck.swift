import SwiftUI

/// The deck scoped to one chart: a head carrying `Present as: Tree | Map`, and under it the
/// parent's children as a tree or as the Route (#334, #335).
///
/// It replaces both deck panes and carries its own head, which is why the room's toolbar empties
/// for it (`cockpit-work-room.md`).
struct ChartDeck: View {
    @Environment(\.argo) private var argo

    let chart: WorkRoomProjection.ChartScope
    @Binding var presentation: WorkPresentation
    /// Built by the room: the fold and the selection it holds are the room's, and threading two
    /// more bindings through this head to reach them would make the head a conduit for state it
    /// never reads.
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
            RoomPresentation(presentation: $presentation, hasRoute: chart.route != nil)
        }
        .padding(ArgoRoute.headPadding)
    }

    /// A chart whose children the poll has not reached falls back to the tree rather than to an
    /// empty canvas — an axis with nothing on it reads as finished work.
    @ViewBuilder private var presented: some View {
        if let route = chart.route, presentation == .map {
            RouteCanvas(route: route)
        } else {
            tree
        }
    }
}

#Preview("Chart deck — the Route") {
    ChartDeckPreview(room: WorkFixture.chartRoom, presenting: .map)
}

#Preview("Chart deck — the tree, scoped") {
    ChartDeckPreview(room: WorkFixture.chartRoom, presenting: .tree)
}

/// One chart's deck, or the reason there is none — so a fixture that stops producing a chart fails
/// loudly in a preview instead of rendering blank.
private struct ChartDeckPreview: View {
    let room: WorkRoomProjection.Room
    let presenting: WorkPresentation

    @State private var presentation = WorkPresentation.tree
    @State private var selection: Int? = 334
    @State private var shut: Set<Int> = []

    var body: some View {
        Group {
            if let chart = room.chart {
                ChartDeck(
                    chart: chart,
                    presentation: $presentation,
                    tree: ScopedTree(rows: room.backlog, selection: $selection, shut: $shut),
                )
            } else {
                Text("No chart — the fixture scoped the deck to nothing")
                    .argoText(ArgoTypography.rowMeta)
            }
        }
        .frame(width: 1100, height: 520)
        .argoDeckSurface()
        .argoAppearance()
        .onAppear { presentation = presenting }
    }
}
