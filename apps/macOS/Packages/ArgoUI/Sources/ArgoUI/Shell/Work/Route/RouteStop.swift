import SwiftUI

/// One child on the Route: the dot, its title beside it, and the ticket's own words under them.
///
/// Positioned by its top-leading corner, so the dot is centred on the title's line box without the
/// canvas having to know the line height.
struct RouteStop: View {
    @Environment(\.argo) private var argo

    let stop: WorkRoomProjection.Route.Stop

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoRoute.labelStep) {
            HStack(spacing: ArgoRoute.labelLead) {
                Circle()
                    .fill(loudness.mark.color)
                    .frame(width: ArgoRoute.dotSize, height: ArgoRoute.dotSize)
                Text(stop.title)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(loudness.ink)
            }
            Text(machineLine)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.disabled)
                .padding(.leading, ArgoRoute.machineLineInset)
        }
        .lineLimit(1)
        .truncationMode(.tail)
        .frame(width: ArgoRoute.labelWidth, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(announcement)
    }

    /// `#id · word`, and the tag after it where the ticket carries one. One line rather than a
    /// chip: a chip on every one of forty dots would spend on the tag what the design spends on the
    /// title.
    private var machineLine: String {
        ["#\(stop.id)", stop.word, stop.tag].compactMap(\.self).joined(separator: " · ")
    }

    /// The zone's whole visual weight, mapped once. Ion Blue on the line as current position; a
    /// quiet neutral ahead of it, so a parent still fully blocked does not read as an emergency.
    /// `state.failure` appears on no zone — red is #338's dead end, which is not a zone.
    private var loudness: (ink: ArgoColor, mark: ArgoColor) {
        switch stop.zone {
        case .behind: (argo.color.text.disabled, argo.color.text.disabled)
        case .now: (argo.color.text.primary, argo.color.interaction.accent)
        case .ahead: (argo.color.text.secondary, argo.color.state.idle)
        }
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607".
    private var announcement: String {
        [String(stop.id), stop.title, stop.word, stop.tag]
            .compactMap(\.self)
            .joined(separator: ", ")
    }
}

#Preview("Route stops — one per zone") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        ForEach(WorkRoomProjection.Route.Zone.allCases, id: \.self) { zone in
            if let stop = WorkFixture.chartRoom.chart?.route?.stops(in: zone).first {
                RouteStop(stop: stop)
            }
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Route stop — a title past the block's width, and a ticket with no tag") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        ForEach(WorkFixture.chartRoom.chart?.route?.stops ?? []) { stop in
            RouteStop(stop: stop)
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
