import ArgoDesign
import AtlasLayout
import SwiftUI

/// The banded Measure, drawn against the repository the file was measured in (#1154, the approved
/// design's `#read .gauge`).
///
/// **A number alone is not a reading.** 12 is meaningless until you know it beats two files in
/// three, which is the whole of the ticket's third criterion: every measure is shown against the
/// range for THIS repository, never an absolute scale. So the value is drawn on the same three
/// bands the volumes on the map are lit with, and the needle stands where this file falls among
/// them.
///
/// The ramp comes from the contract's own `MeasureRoles`, exactly as the legend beside the map
/// takes it — one ramp, so a file's roof, the key and this gauge cannot say three different things
/// about one colour.
struct AtlasReadingGauge: View {
    @Environment(\.argo) private var argo

    let gauge: AtlasGauge

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            heading
            if let placement = gauge.placement {
                track(placement)
                ends
                Text(note(placement))
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, ArgoSpacing.snug)
            } else {
                // No needle at all, rather than one standing at the foot of the ramp: the bottom
                // of a range is a measurement, and this file has none (#1154's last criterion).
                Text("Not measured for this file.")
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
                    .padding(.top, ArgoSpacing.snug)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// The Measure's name and this file's value, on one baseline — the design's `.gh`.
    private var heading: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.base) {
            Text(gauge.measure)
                .textCase(.uppercase)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: ArgoSpacing.base)
            if let placement = gauge.placement {
                Text(placement.value.formatted(.measured))
                    .argoText(ArgoTypography.machineHeading)
                    .foregroundStyle(argo.color.text.primary)
            }
        }
    }

    /// The three bands, each as wide as the share of the repository it stands for, with the needle
    /// at this file's own place along them.
    ///
    /// The widths are read OFF THE CUTS rather than typed, for `AtlasLegendKey`'s reason: typed,
    /// they are a second place the band edges live, and the day one moves the gauge goes on
    /// drawing the old shares with nothing anywhere saying so.
    private func track(_ placement: AtlasPlacement) -> some View {
        GeometryReader { proxy in
            HStack(spacing: ArgoSpacing.flush) {
                let measure = argo.color.atlas.measure
                let quiet = ArgoPalette.MeasureRoles.middlingFrom
                let hot = ArgoPalette.MeasureRoles.hotFrom
                band(measure.quiet, proxy.size.width * quiet)
                band(measure.middling, proxy.size.width * (hot - quiet))
                band(measure.hot, proxy.size.width * (1 - hot))
            }
            .frame(height: AtlasGaugeMeasure.trackHeight)
            .clipShape(.rect(cornerRadius: ArgoRadius.marker))
            .frame(height: AtlasGaugeMeasure.needleHeight)
            .overlay(alignment: .leading) {
                needle.offset(x: proxy.size.width * placement.fraction)
            }
        }
        .frame(height: AtlasGaugeMeasure.needleHeight)
        .padding(.top, ArgoSpacing.base)
    }

    private func band(_ ink: ArgoColor, _ width: CGFloat) -> some View {
        Rectangle().fill(ink).frame(width: max(0, width))
    }

    /// The needle stands PROUD of the bands, which is why the bands are clipped and it is not: a
    /// file in the top percent sits at the very end, where a clip would eat it. The dark contact
    /// ring is what keeps it visible over the light middle of the ramp, where every white edge in
    /// the contract vanishes.
    private var needle: some View {
        Rectangle()
            .fill(.black.opacity(AtlasGaugeMeasure.ringOpacity))
            .frame(
                width: ArgoStroke.indicator + ArgoStroke.border * 2,
                height: AtlasGaugeMeasure.needleHeight,
            )
            .overlay {
                Rectangle()
                    .fill(argo.color.text.primary)
                    .frame(
                        width: ArgoStroke.indicator,
                        height: AtlasGaugeMeasure.needleHeight - ArgoStroke.border * 2,
                    )
            }
            .offset(x: -(ArgoStroke.indicator / 2 + ArgoStroke.border))
    }

    /// Which end is which. The words rather than the values: both ends of the ramp are already in
    /// the legend beside the map, and this gauge is about WHERE THIS FILE IS.
    private var ends: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text("lowest here")
            Spacer(minLength: ArgoSpacing.base)
            Text("highest")
        }
        .argoText(ArgoTypography.machineCaption)
        .foregroundStyle(argo.color.text.tertiary)
        .padding(.top, ArgoSpacing.tight)
    }

    /// The reading in words, because the needle is a position and the reader wants a sentence. A
    /// file at the very top gets its own, since "higher than 100%" is a claim about itself.
    private func note(_ placement: AtlasPlacement) -> String {
        guard placement.fraction <= AtlasGaugeMeasure.topOfTheRepository else {
            return "At the very top of this repo. Nothing scores higher."
        }
        return "Higher than \(placement.fraction.formatted(.share)) of the files in this repo."
    }
}

/// The gauge's own measures. Here rather than in the contract for `AtlasKeyMeasure`'s reason: they
/// describe this one strip and nothing else in the app.
enum AtlasGaugeMeasure {
    /// The band of colour, at the rung the map's legend draws its own ramp a step under — this one
    /// carries a needle, and a needle needs a band thick enough to sit on.
    static let trackHeight = ArgoIconSize.inline.rawValue

    /// How far the needle stands, which is the band plus the amount it stands proud at each end.
    static let needleHeight = trackHeight + ArgoSpacing.snug

    /// The contact ring under the needle. Not an edge token: every edge in the contract is a white
    /// alpha, and over a light band all of them vanish.
    static let ringOpacity = 0.6

    /// Past this, a file is at the top of its repository rather than above a share of it.
    static let topOfTheRepository = 0.995
}
