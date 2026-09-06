import ArgoDesign
import AtlasLayout
import SwiftUI

/// The key the map is read with: which Measure the colour is, and what a value is worth at each
/// end of the ramp (#1147). A section of the sidebar, under the channels that decide it — the
/// design's `AtlasLegend`, and the reason a colour change is readable rather than merely visible
/// (#1161).
///
/// It draws the contract's own ramp as one pass rather than three swatches, because a hard-edged
/// pass is itself the claim the map makes: three bands, no wash, and no colour between two of them
/// in any legend.
public struct AtlasLegendKey: View {
    @Environment(\.argo) private var argo

    let legend: AtlasLegend
    let measure: ArgoPalette.MeasureRoles

    public init(legend: AtlasLegend, measure: ArgoPalette.MeasureRoles) {
        self.legend = legend
        self.measure = measure
    }

    public var body: some View {
        AtlasSidebarSection("Legend") {
            Text("Colour · \(legend.measure)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .textCase(.uppercase)
            // The rail's width and not a measure of its own: the sidebar is dragged by the reader,
            // and a fixed ramp inside it would either truncate or leave a gutter at every width
            // but one.
            measure.ramp.pass
                .frame(maxWidth: .infinity)
                .frame(height: AtlasKeyMeasure.passHeight)
                // A pill, which is how the approved render draws it.
                .clipShape(.capsule)
            HStack(spacing: ArgoSpacing.base) {
                AtlasLegendEnd(value: quiet, share: quietShare, aligned: .leading)
                Spacer(minLength: ArgoSpacing.base)
                AtlasLegendEnd(value: hot, share: hotShare, aligned: .trailing)
            }
        }
    }

    /// The two ends, in the words the ramp runs in: the head of the quiet half, and the foot of
    /// the hot top. A Measure the repository carries no value for names no number — an em dash
    /// rather than a zero, because zero is a measurement and this is the absence of one.
    private var quiet: String {
        legend.greatestQuiet.map { "≤ " + $0.formatted(.measured) } ?? AtlasUnmeasured.compact
    }

    private var hot: String {
        legend.leastHot.map { "> " + $0.formatted(.measured) } ?? AtlasUnmeasured.compact
    }

    /// What share of the repository each end stands for, READ OFF THE CUTS rather than written
    /// under the ramp. Typed, these two captions are a second place the band edges live, and the
    /// day one moves the key goes on claiming the old share with nothing anywhere saying so.
    private var quietShare: String {
        "quietest " + ArgoPalette.MeasureRoles.middlingFrom.formatted(.share)
    }

    private var hotShare: String {
        "top " + (1 - ArgoPalette.MeasureRoles.hotFrom).formatted(.share)
    }
}

/// One end of the ramp: what a value is worth there, and what share of the repository stands on
/// that side of the cut.
private struct AtlasLegendEnd: View {
    @Environment(\.argo) private var argo

    let value: String
    let share: String
    let aligned: HorizontalAlignment

    var body: some View {
        // Flush: the value and the share it stands for are one reading, and a line of air between
        // them makes the share read as a row of its own.
        VStack(alignment: aligned, spacing: ArgoSpacing.flush) {
            Text(value)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.secondary)
            // The machine face here too, so the key is set in ONE voice: the approved render puts
            // the proportional face on the map and the machine face on everything beside it.
            Text(share)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
        }
    }
}

/// The key's own two measures. Here rather than in the contract for the reason every other
/// surface's measures sit beside it: they describe this one strip and nothing else in the app.
enum AtlasKeyMeasure {
    /// A band of colour with nothing on it, so it is set at the smallest rung the contract draws a
    /// mark at. The measure sheet draws the same ramp a rung heavier, which is right there and
    /// wrong here: on that sheet the ramp IS the subject, and here the map is.
    static let passHeight = ArgoIconSize.chevron.rawValue
}
