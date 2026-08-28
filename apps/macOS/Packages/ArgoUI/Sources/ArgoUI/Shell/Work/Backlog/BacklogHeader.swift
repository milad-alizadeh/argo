import SwiftUI

/// What you are looking at and how many, over the list it counts — **inside the pane, not in the
/// window's toolbar** (#836).
///
/// **Two lines, and the second is not decoration.** A title without its count can lie about what
/// you are filtered to: `Backlog` alone reads the same over twelve tickets and over the four that
/// survived a filter. Mail's own band says `Inbox — …` over `All Mail · 290 messages, 149 unread`
/// for this reason.
///
/// In the pane and not the window's row, because its controls are the list's and have to end where
/// the list ends — `cockpit-work-room.md`, the column question (#836).
struct BacklogHeader: View {
    @Environment(\.argo) private var argo

    let reading: WorkChromeProjection.Reading
    /// The list's own controls. Absent with no list to narrow — the same absence the search field
    /// takes in the row above.
    var narrowing: () -> Void = {}
    var grouping: () -> Void = {}

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            lines
            Spacer(minLength: ArgoSpacing.base)
            if reading.narrows {
                controls
            }
        }
        .padding(.horizontal, ArgoBacklogList.bandInsetX)
        .frame(minHeight: ArgoBacklogList.bandHeight)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(reading.heading), \(reading.subtitle)")
    }

    /// Filter, then the menu that holds every other way to order the list — Mail's own pair, in
    /// Mail's own order. The rule between them is what stops one capsule reading as one control.
    private var controls: some View {
        ToolbarVessel {
            ToolbarIcon(symbol: ArgoSymbol.filterBacklog, label: "Filter", act: narrowing)
            DeckSeparator()
                .frame(height: ArgoWorkChrome.splitDividerHeight)
                .accessibilityHidden(true)
            BacklogMenu(grouping: grouping)
        }
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

#Preview("Backlog header") {
    BacklogHeader(
        reading: WorkChromeProjection.reading(
            of: WorkFixture.room, in: .allOpen, showing: 272,
        ),
    )
    .frame(width: ArgoBacklogList.width)
    .argoDeckSurface()
    .argoAppearance()
}

// The vacancy: the provider answered with nothing, so the count says zero and the two controls that
// narrow a list are gone with the list.
#Preview("Backlog header — the provider answered with nothing") {
    BacklogHeader(
        reading: WorkChromeProjection.reading(
            of: WorkRoomProjection.room(from: WorkFixture.answeredEmpty),
            in: .allOpen,
            showing: nil,
        ),
    )
    .frame(width: ArgoBacklogList.width)
    .argoDeckSurface()
    .argoAppearance()
}
