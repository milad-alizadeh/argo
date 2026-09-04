import ArgoDesign
import SwiftUI

/// Icon buttons sharing one glass capsule — a header's unit of grouping.
///
/// **No border and no drop shadow**, which `argoFloatingGlass` already spells:
/// `ArgoElevation.vessel` is zero on all three axes because the specular rim IS the depth cue, so a
/// hairline would stack a second edge on the one the material already draws.
///
/// It spends `ArgoControlBox.vesselInset` round its buttons, which is what makes a capsule holding
/// three stand exactly as tall as a lone button carrying a container of its own.
public struct ArgoIconButtonGroup<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        HStack(spacing: ArgoControlBox.vesselGap) {
            content
        }
        .padding(ArgoControlBox.vesselInset)
        .argoFloatingGlass(in: .capsule)
    }
}

/// The rule between the segments of one such capsule — the verb and the two link marks past it.
///
/// Hidden from VoiceOver: it parts what the eye groups and says nothing a reader moving by control
/// needs to hear.
public struct ArgoIconButtonRule: View {
    @Environment(\.argo) private var argo

    public init() {}

    public var body: some View {
        ArgoRule(ink: argo.color.edge.hairline)
            .frame(height: ArgoControlBox.vesselRuleHeight)
            .accessibilityHidden(true)
    }
}

#Preview("Icon button group — one mark, and marks sharing a capsule past a rule") {
    @Previewable @Environment(\.argo) var argo

    HStack(spacing: ArgoSpacing.comfortable) {
        ArgoIconButtonGroup {
            ArgoIconButton(
                ArgoSymbol.newTicket,
                voice: ArgoControlVoice("New ticket"),
                face: ArgoControlFace(ink: argo.color.text.tertiary),
                act: {},
            )
        }
        ArgoIconButtonGroup {
            ArgoIconButton(
                ArgoSymbol.openOnHost,
                voice: ArgoControlVoice("Open on host"),
                face: ArgoControlFace(ink: argo.color.text.tertiary),
                act: {},
            )
            ArgoIconButtonRule()
            ArgoIconButton(
                ArgoSymbol.copyLink,
                voice: ArgoControlVoice("Copy link"),
                face: ArgoControlFace(ink: argo.color.text.tertiary),
                act: {},
            )
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
