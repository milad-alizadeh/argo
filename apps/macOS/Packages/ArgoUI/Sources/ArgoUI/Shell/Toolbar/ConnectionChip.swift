import SwiftUI

/// A factual exception chip; a connection with something live on it renders nothing at all.
///
/// "No live sessions" is drawn rather than left blank because it is a different fact from being
/// connected, and the blank would be read as the connected one.
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
        case .connected: "Connected"
        case .idle: "No live sessions"
        case let .failed(message): message
        }
    }

    private var state: ArgoOperationalState {
        switch connection {
        case .connected, .idle: .idle
        case .failed: .failure
        }
    }

    private var canRetry: Bool {
        if case .failed = connection {
            return true
        }
        return false
    }

    private var edge: ArgoColor {
        contrast == .increased ? argo.color.edge.strong : argo.color.edge.subtle
    }
}

#Preview("Connection exceptions") {
    VStack(spacing: ArgoSpacing.comfortable) {
        ConnectionChip(connection: .idle, retry: {})
        ConnectionChip(connection: .failed(message: "Transcript unavailable"), retry: {})
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
