import SwiftUI

/// The prompt's first line: what this vessel is, and how long it will wait. The clock is drawn
/// because the hook's `timeout` is real — without it, walking away looks free.
struct PermissionPromptHeader: View {
    @Environment(\.argo) private var argo

    let deniesAtMs: Int

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            HStack(spacing: ArgoSpacing.tight) {
                ArgoGlyph(ArgoSymbol.permission, .control)
                Text("Permission")
                    .argoText(ArgoTypography.sectionLabel)
                    .textCase(.uppercase)
                Spacer()
                Text("denies in \(remaining(at: context.date))")
                    .argoText(ArgoTypography.machineCaption)
            }
            .foregroundStyle(argo.color.state.attention)
        }
    }

    private func remaining(at date: Date) -> String {
        let seconds = max(0, (deniesAtMs - date.epochMs) / 1000)
        return "\(seconds / 60):" + String(format: "%02d", seconds % 60)
    }
}

/// The patience window, drawn: what is left of the hook's own clock, as a line burning down the
/// vessel's bottom edge.
struct PermissionPromptFuse: View {
    @Environment(\.argo) private var argo

    let raisedAtMs: Int
    let deniesAtMs: Int

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            GeometryReader { proxy in
                RoundedRectangle(cornerRadius: ArgoRadius.marker)
                    .fill(argo.color.state.attention)
                    .frame(width: proxy.size.width * fraction(at: context.date))
            }
            .frame(height: ArgoStroke.indicator)
        }
    }

    private func fraction(at date: Date) -> CGFloat {
        let window = deniesAtMs - raisedAtMs
        guard window > 0 else { return 0 }
        return CGFloat(max(0, deniesAtMs - date.epochMs)) / CGFloat(window)
    }
}
