import SwiftUI

/// One of the provider's own labels, set verbatim. Argo neither translates a label nor files it
/// under a vocabulary of its own: a label is the tracker's word, and a reader matching what they
/// see here against what they see in the tracker is the whole point of showing it.
///
/// It takes no hue for the same reason `ArgoBadge` takes none — a label marks a KIND of thing, and
/// hue in this palette is rationed to the four operational states (`rules/design-system.md`).
struct LabelChip: View {
    @Environment(\.argo) private var argo

    let label: String

    var body: some View {
        Text(label)
            .argoText(ArgoTypography.badge)
            .foregroundStyle(argo.color.text.secondary)
            .padding(.horizontal, ArgoTicketDetail.labelInsetX)
            .padding(.vertical, ArgoTicketDetail.labelInsetY)
            .background(
                argo.color.surface.control,
                in: .rect(cornerRadius: ArgoRadius.marker),
            )
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.marker)
                    .strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.border)
            }
    }
}

#Preview("Label chips — a short label and a long one") {
    HStack(spacing: ArgoTicketDetail.labelGap) {
        LabelChip(label: "ui")
        LabelChip(label: "work-room")
        LabelChip(label: "ready-for-agent")
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
