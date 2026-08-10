import SwiftUI

/// The panel the ⓘ opens. Its words are `SessionHeaderProjection.Context`'s — this draws them.
struct SessionContextGuide: View {
    @Environment(\.argo) private var argo

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            ForEach(SessionHeaderProjection.Context.guide) { line in
                self.line(line)
            }
            Text(SessionHeaderProjection.Context.remedy)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ArgoSpacing.loose)
        .frame(width: ArgoLayout.contextGuideWidth, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("About the context reading")
    }

    private func line(_ line: SessionHeaderProjection.Context.GuideLine) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.base) {
            Text(line.threshold)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(line.tier.tint(in: argo.color))
                .frame(width: ArgoLayout.contextGuideThresholdWidth, alignment: .leading)
            Text(line.meaning)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
        }
    }
}

#Preview("Context guide — the two lines, decoded once") {
    SessionContextGuide()
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
