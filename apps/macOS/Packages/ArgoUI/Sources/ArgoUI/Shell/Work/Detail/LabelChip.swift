import ArgoEngine
import SwiftUI

/// One of the provider's own labels, set verbatim and in the colour the provider set it in — read
/// into inks this deck can carry by `LabelInk`.
///
/// The hue is a READING of the tracker, not a state Argo is claiming: it says which label this is,
/// the way it does on the tracker itself, and never what the ticket is doing. The four operational
/// states keep their own hues and are drawn elsewhere (`rules/design-system.md`).
struct LabelChip: View {
    @Environment(\.argo) private var argo

    let word: String
    /// The label this chip draws, where it is one. `nil` says this chip is Argo's own overflow
    /// count rather than a provider label, which has no hue to spend either way.
    var label: WorkItemLabel?

    init(label: WorkItemLabel) {
        self.word = label.name
        self.label = label
    }

    /// Argo's own marker over the labels a row had no width for. Neutral by construction: it counts
    /// labels rather than being one, so no provider colour could be right for it.
    init(counting word: String) {
        self.word = word
    }

    /// Read here rather than at the call site because the treatment needs the surface the chip sits
    /// on, and that is a palette fact only a view holds — see `LabelInk`.
    private var ink: LabelInk? {
        label.flatMap { LabelInk($0, on: argo.color.surface.base) }
    }

    var body: some View {
        Text(word)
            .argoText(ArgoTypography.badge)
            .foregroundStyle(ink?.word ?? argo.color.text.secondary)
            .padding(.horizontal, ArgoTicketDetail.labelInsetX)
            .padding(.vertical, ArgoTicketDetail.labelInsetY)
            .background(
                ink?.ground ?? argo.color.surface.control,
                in: .rect(cornerRadius: ArgoRadius.marker),
            )
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.marker)
                    .strokeBorder(
                        ink?.edge ?? argo.color.edge.hairline, lineWidth: ArgoStroke.border,
                    )
            }
    }
}

#Preview("Label chips — the provider's colours, one it gave none, and Argo's own count") {
    HStack(spacing: ArgoTicketDetail.labelGap) {
        LabelChip(label: WorkItemLabel(name: "bug", colour: "d73a4a"))
        LabelChip(label: WorkItemLabel(name: "enhancement", colour: "a2eeef"))
        LabelChip(label: WorkItemLabel(name: "ready-for-agent", colour: "0e8a16"))
        LabelChip(label: WorkItemLabel(name: "wayfinder:map", colour: "5319e7"))
        LabelChip(label: WorkItemLabel(name: "unread"))
        LabelChip(counting: "+2")
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
