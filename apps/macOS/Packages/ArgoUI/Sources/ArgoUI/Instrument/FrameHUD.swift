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
            figure("p50", reading.p50)
            figure("p95", reading.p95)
            figure("worst", reading.worst)
            dropped
        }
        .padding(.vertical, ArgoSpacing.snug)
        .padding(.horizontal, ArgoSpacing.comfortable)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.popover))
        .accessibilityHidden(true)
    }

    private func figure(_ label: String, _ milliseconds: Double) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
            Text(String(format: "%.1f", milliseconds))
                .argoText(ArgoTypography.caption)
                .monospacedDigit()
                .foregroundStyle(ink(over: milliseconds))
        }
    }

    private var dropped: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("dropped")
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
            Text("\(reading.dropped)/\(reading.count)")
                .argoText(ArgoTypography.caption)
                .monospacedDigit()
                .foregroundStyle(reading.dropped > 0 ? argo.color.state.attention : ink(over: 0))
        }
    }

    /// A number over the floor is the failure this exists to show, so it is the one number that
    /// changes colour. Everything under it reads at the ordinary ink.
    private func ink(over milliseconds: Double) -> ArgoColor {
        milliseconds > FrameReading.floor ? argo.color.state.attention : argo.color.text.primary
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
