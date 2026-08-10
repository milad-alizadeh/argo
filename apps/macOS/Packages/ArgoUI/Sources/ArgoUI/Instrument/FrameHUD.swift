import SwiftUI

/// The frame reading, on screen. Four numbers and nothing else: the median a drag holds, the tail
/// it spends, the worst single frame, and how many of them missed the 60fps floor.
///
/// Takes a value, like every other view here — so what it draws can be looked at without a display
/// link, and the thing that owns the link owns no drawing.
struct FrameHUD: View {
    @Environment(\.argo) private var argo

    let reading: FrameReading

    var body: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            FrameFigure(label: "p50", value: reading.p50)
            FrameFigure(label: "p95", value: reading.p95)
            FrameFigure(label: "worst", value: reading.worst)
            FrameFigure(
                label: "dropped",
                reading: "\(reading.dropped)/\(reading.count)",
                isOver: reading.dropped > 0,
            )
        }
        .padding(.vertical, ArgoSpacing.snug)
        .padding(.horizontal, ArgoSpacing.comfortable)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.popover))
        .accessibilityHidden(true)
    }
}

/// One labelled number. A view rather than a builder function, so the four of them cannot drift
/// apart and the count reads the same way the three intervals do.
private struct FrameFigure: View {
    @Environment(\.argo) private var argo

    let label: String
    let reading: String
    /// Whether this number is the failure the HUD exists to show. It is the only thing that
    /// changes colour: a figure nobody compares reads as loud whatever ink it is in.
    let isOver: Bool

    /// An interval in milliseconds, which is what three of the four are.
    init(label: String, value: Double) {
        self.init(
            label: label,
            reading: String(format: "%.1f", value),
            isOver: value > FrameReading.floor,
        )
    }

    init(label: String, reading: String, isOver: Bool) {
        self.label = label
        self.reading = reading
        self.isOver = isOver
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            Text(label)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
            Text(reading)
                .argoText(ArgoTypography.caption)
                .monospacedDigit()
                .foregroundStyle(isOver ? argo.color.state.attention : argo.color.text.primary)
        }
    }
}

#Preview("Frame HUD — a drag holding the floor") {
    FrameHUD(reading: FrameReading(milliseconds: Array(repeating: 8.3, count: 240)))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Frame HUD — a drag missing it") {
    FrameHUD(reading: FrameReading(milliseconds: [8.3, 8.4, 24.1, 8.3, 41.7, 9.0, 8.2, 33.4]))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Frame HUD — nothing observed yet") {
    FrameHUD(reading: FrameReading(milliseconds: []))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
