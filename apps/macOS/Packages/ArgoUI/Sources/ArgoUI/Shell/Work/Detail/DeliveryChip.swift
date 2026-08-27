import SwiftUI

/// One Delivery, as a bordered OBJECT rather than a row in a list (`cockpit-work-room.md` — the
/// ticket detail). It carries its number, its branch, its diff and what the checks said, and it
/// deep-links to the code host.
///
/// A chip and not a row because two Deliveries on one ticket are two things in flight, each with
/// its own signal — a list would read as one lifecycle with steps, which is the Session's story and
/// not this one (#272).
struct DeliveryChip: View {
    @Environment(\.argo) private var argo
    @Environment(\.openURL) private var openURL

    let delivery: DeliveryFacts

    var body: some View {
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

    /// The two diff inks, which are held off every other hue in the palette — a change's size is
    /// not one of the four operational states and never borrows their colour.
    private var diff: some View {
        HStack(spacing: ArgoSpacing.tight) {
            Text("+\(delivery.added)")
                .foregroundStyle(argo.color.diff.added.color)
            Text("−\(delivery.removed)")
                .foregroundStyle(argo.color.diff.removed.color)
        }
        .argoText(ArgoTypography.machineCaption)
    }

    /// Nothing where nothing was read: a chip that has not heard from the checks says so by
    /// leaving the slot empty rather than by drawing the quiet end of a two-state vocabulary.
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
}

#Preview("Delivery chips — passing, failing, and nothing read") {
    VStack(alignment: .leading, spacing: ArgoTicketDetail.chipGap) {
        ForEach(WorkFixture.everyChecksReading) { DeliveryChip(delivery: $0) }
    }
    .padding(ArgoSpacing.region)
    .frame(width: ArgoTicketDetail.idealWidth, alignment: .leading)
    .argoDeckSurface()
    .argoAppearance()
}
