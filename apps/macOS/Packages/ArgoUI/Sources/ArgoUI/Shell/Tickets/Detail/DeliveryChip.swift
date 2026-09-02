import ArgoDesign
import SwiftUI

/// One Delivery as a bordered object, deep-linking to the code host (`cockpit-work-room.md` — the
/// ticket detail).
package struct DeliveryChip: View {
    @Environment(\.argo) private var argo
    @Environment(\.openURL) private var openURL

    let delivery: DeliveryFacts

    package var body: some View {
        if let url = delivery.url {
            Button { openURL(url) } label: { chip }
                .buttonStyle(.plain)
                .help("Open \(delivery.name) on the code host")
                .accessibilityLabel(announcement)
        } else {
            chip.accessibilityLabel(announcement)
        }
    }

    private var chip: some View {
        HStack(spacing: ArgoTicketDetail.chipGap) {
            Text(delivery.name)
                .argoText(ArgoTypography.machineEmphasis)
                .foregroundStyle(argo.color.text.primary)
            Text(delivery.branch)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.middle)
            diff
            checks
        }
        .padding(.horizontal, ArgoTicketDetail.chipInsetX)
        .padding(.vertical, ArgoTicketDetail.chipInsetY)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
        }
    }

    /// `diff.added` and `diff.removed`, which are held off the four operational states by
    /// construction: a change's size is not one of them.
    private var diff: some View {
        HStack(spacing: ArgoSpacing.tight) {
            Text("+\(delivery.added)")
                .foregroundStyle(argo.color.diff.added.color)
            Text("−\(delivery.removed)")
                .foregroundStyle(argo.color.diff.removed.color)
        }
        .argoText(ArgoTypography.machineCaption)
    }

    /// Empty where nothing was read, rather than the quiet end of a two-state vocabulary.
    @ViewBuilder private var checks: some View {
        if let reading = checksReading {
            Text(reading.word)
                .argoText(ArgoTypography.badge)
                .foregroundStyle(reading.ink.color)
        }
    }

    private var checksReading: (word: String, ink: ArgoColor)? {
        switch delivery.checks {
        case .passing: ("checks passing", argo.color.state.running)
        case .failing: ("checks failing", argo.color.state.failure)
        case .unread: nil
        }
    }

    private var announcement: String {
        [delivery.name, delivery.branch, checksReading?.word]
            .compactMap(\.self)
            .joined(separator: ", ")
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(delivery: DeliveryFacts) {
        self.delivery = delivery
    }
}
