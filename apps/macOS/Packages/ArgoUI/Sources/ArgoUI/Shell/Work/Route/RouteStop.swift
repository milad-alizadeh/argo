import SwiftUI

/// One child on the Route: the dot, its title BESIDE it, and the ticket's own words under them.
///
/// Never a side list. #334's layout finding is that legibility is decided by what a dot carries
/// rather than by the arrangement — which is why the Route is a left-to-right axis at all, and why
/// the title travels with the mark.
///
/// The block is positioned by its TOP-LEADING corner, so the dot is centred on the title's own line
/// box rather than on a vertical the canvas had to know the line height to compute. What the axis
/// addresses is therefore the top of a label block; #337, which derives the spacing from real label
/// widths, is where that becomes a measured baseline.
struct RouteStop: View {
    @Environment(\.argo) private var argo

    let stop: WorkRoomProjection.Route.Stop

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoRoute.labelStep) {
            HStack(spacing: ArgoRoute.labelLead) {
                Circle()
                    .fill(mark.color)
                    .frame(width: ArgoRoute.dotSize, height: ArgoRoute.dotSize)
                Text(stop.title)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(ink)
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
    /// chip: a tag is a quiet fact about the ticket, and a chip on every dot would spend on forty
    /// stops what this design spends on a title.
    private var machineLine: String {
        ["#\(stop.id)", stop.word, stop.tag].compactMap(\.self).joined(separator: " · ")
    }

    /// The ink the title is set in — the loudness of a zone, which is the one thing the three zones
    /// differ by here. Colour is spent narrowly (`cockpit-work-room.md`): closed work behind the
    /// line is `text.disabled`, and the takeable set is the only one that reads at full strength.
    private var ink: ArgoColor {
        switch stop.zone {
        case .behind: argo.color.text.disabled
        case .now: argo.color.text.primary
        case .ahead: argo.color.text.secondary
        }
    }

    /// The dot's fill. Ion Blue on the line as CURRENT POSITION — #334's gold clause is superseded
    /// and `--eclipse-gold` never existed in any contract. Waiting is `state.idle`, a quiet
    /// neutral, so a parent where everything is still blocked does not read as an emergency on day
    /// one.
    ///
    /// `state.failure` appears on no zone here: red is reserved for a ticket that can never
    /// unblock, which is #338's dead end and not a zone.
    private var mark: ArgoColor {
        switch stop.zone {
        case .behind: argo.color.text.disabled
        case .now: argo.color.interaction.accent
        case .ahead: argo.color.state.idle
        }
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607" —
    /// the same reason `BacklogRow` does.
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
