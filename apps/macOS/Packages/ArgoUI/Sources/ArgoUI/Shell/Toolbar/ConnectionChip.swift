import SwiftUI

/// A factual exception chip; healthy connectivity renders nothing at all.
struct ConnectionChip: View {
    @Environment(\.argo) private var argo
    @Environment(\.colorSchemeContrast) private var contrast

    let connection: CockpitPresentation.Connection
    let retry: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Circle()
                .fill(state.tint(in: argo.color))
                .frame(width: ArgoLayout.statusDotSize, height: ArgoLayout.statusDotSize)
                .accessibilityHidden(true)
            Text(label)
                .argoText(ArgoTypography.caption)
                .lineLimit(1)
            if canRetry {
                Button("Retry", action: retry)
                    .buttonStyle(.plain)
                    .argoText(ArgoTypography.control)
            }
        }
        .foregroundStyle(state.tint(in: argo.color))
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.snug)
        .background {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .fill(argo.color.surface.overlay)
        }
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(edge, lineWidth: ArgoStroke.border)
        }
        .frame(width: ArgoLayout.connectionSlotWidth, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var label: String {
        switch connection {
        case .healthy: "Connected"
        case .reconnecting: "Reconnecting"
        case let .failed(message): message
        }
    }

    private var state: ArgoOperationalState {
        switch connection {
        case .healthy: .idle
        case .reconnecting: .attention
        case .failed: .failure
        }
    }

    private var canRetry: Bool {
        if case .failed = connection { return true }
        return false
    }

    private var edge: ArgoColor {
        contrast == .increased ? argo.color.edge.strong : argo.color.edge.subtle
    }
}

#Preview("Connection exceptions") {
    VStack(spacing: ArgoSpacing.comfortable) {
        ConnectionChip(connection: .reconnecting, retry: {})
        ConnectionChip(connection: .failed(message: "Transcript unavailable"), retry: {})
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
