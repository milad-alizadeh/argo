import ArgoEngine
import SwiftUI

/// A factual exception chip; a connection with nothing wrong on it renders nothing at all.
///
/// One chip for both subjects — Argo's own observation, and the health of the active Project's
/// provider Bindings — because a second failure chrome beside this one would be a second failure
/// language for the same reader. What differs between them is the reading, never the shape.
struct ConnectionChip: View {
    @Environment(\.argo) private var argo
    @Environment(\.colorSchemeContrast) private var contrast

    let reading: ConnectionChipReading
    let act: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Circle()
                .fill(reading.state.tint(in: argo.color))
                .frame(width: ArgoIconSize.statusDot, height: ArgoIconSize.statusDot)
                .accessibilityHidden(true)
            Text(reading.label)
                .argoText(ArgoTypography.caption)
                .lineLimit(1)
                // The ceiling sits on the LABEL, not on the chip. A provider's own sentence can run
                // to any length, and it is the only part of this that may be cut — a truncated
                // Reconnect is a control nobody can read.
                .frame(maxWidth: ArgoToolbarVessel.connectionSlotMaximumWidth, alignment: .leading)
            if let action = reading.action {
                Button(action, action: act)
                    .buttonStyle(.plain)
                    .argoText(ArgoTypography.control)
            }
        }
        .foregroundStyle(reading.state.tint(in: argo.color))
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
        .frame(minWidth: ArgoToolbarVessel.connectionSlotWidth, alignment: .leading)
        .fixedSize(horizontal: true, vertical: false)
        .accessibilityElement(children: .combine)
    }

    private var edge: ArgoColor {
        contrast == .increased ? argo.color.edge.strong : argo.color.edge.subtle
    }
}

#Preview("Observation states") {
    // `.connected` is absent because it draws nothing: it is the one state of the four that
    // produces no reading at all, and a preview of it would be a preview of the empty chrome.
    let readings = [HubConnection.connecting, .idle, .failed(message: "Transcript unavailable")]
        .compactMap(ConnectionChipReading.init(observing:))

    VStack(spacing: ArgoSpacing.comfortable) {
        ForEach(readings, id: \.label) { reading in
            ConnectionChip(reading: reading, act: {})
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Connection health — the two levels") {
    VStack(spacing: ArgoSpacing.comfortable) {
        ConnectionChip(
            reading: ConnectionChipReading(
                label: "GitHub · 4m ago · offline",
                state: .attention,
                action: nil,
            ),
            act: {},
        )
        ConnectionChip(
            reading: ConnectionChipReading(
                label: "2 connections stale",
                state: .attention,
                action: nil,
            ),
            act: {},
        )
        ConnectionChip(
            reading: ConnectionChipReading(
                label: "GitHub · work · needs reconnect",
                state: .failure,
                action: "Reconnect",
            ),
            act: {},
        )
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
