import SwiftUI

/// What you are looking at, and how many — the list-scoped block at the row's leading edge.
///
/// **Two lines, and the second is not decoration.** A title without its count can lie about what
/// you are filtered to: `Backlog` alone reads the same over twelve tickets and over the four that
/// survived a filter. Mail's own bar says `Searching / Inbox — …, 11 results` for this reason.
///
/// It claims `ArgoWorkToolbar.listBlockWidth` at the leading edge, which is the backlog's own
/// width. That is what places it over the list AND puts every control after it over the ticket
/// column — see `WorkToolbar` for why the row settles the columns this way rather than with
/// per-column toolbar regions.
struct BacklogToolbarLabel: View {
    @Environment(\.argo) private var argo

    let reading: WorkToolbarProjection.Reading
    /// The list's own controls, drawn at the block's trailing edge because that is where the block
    /// meets the list it narrows. Absent with no list to narrow.
    var narrowing: () -> Void = {}
    var grouping: () -> Void = {}

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            lines
            Spacer(minLength: ArgoSpacing.base)
            if reading.narrows {
                ToolbarVessel {
                    ToolbarIcon(
                        symbol: ArgoSymbol.filterBacklog, label: "Filter", act: narrowing,
                    )
                    ToolbarIcon(
                        symbol: ArgoSymbol.groupBacklog, label: "Group by", act: grouping,
                    )
                }
            }
        }
        .frame(width: ArgoWorkToolbar.listBlockWidth, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(reading.heading), \(reading.subtitle)")
    }

    private var lines: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            Text(reading.heading)
                .argoText(ArgoTypography.windowTitle)
                .foregroundStyle(argo.color.text.primary)
            Text(reading.subtitle)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .accessibilityHidden(true)
    }
}

#Preview("Backlog toolbar label") {
    BacklogToolbarLabel(
        reading: WorkToolbarProjection.reading(
            of: WorkFixture.room, in: .allOpen, showing: 272,
        ),
    )
    .padding(ArgoSpacing.comfortable)
    .argoAppearance()
}

// The vacancy: the provider answered with nothing, so the count says zero and the two controls that
// narrow a list are gone with the list.
#Preview("Backlog toolbar label — the provider answered with nothing") {
    BacklogToolbarLabel(
        reading: WorkToolbarProjection.reading(
            of: WorkRoomProjection.room(from: WorkFixture.answeredEmpty),
            in: .allOpen,
            showing: nil,
        ),
    )
    .padding(ArgoSpacing.comfortable)
    .argoAppearance()
}
