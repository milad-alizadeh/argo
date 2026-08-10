import ArgoEngine
import SwiftUI

/// The composer's slot while the agent waits on a decision: the vessel becomes the prompt — one
/// input surface, always holding whichever question is live. The field is replaced, not disabled,
/// because there is nothing to type into while the agent is blocked on you.
struct PermissionPrompt: View {
    @Environment(\.argo) private var argo

    let prompt: PermissionPromptProjection.Prompt
    /// The user's answer. A closure and not a driver, so the vessel renders from a preview or a
    /// specimen with nothing behind it. Never `ask` by construction — the type has no case for it.
    let decide: (PermissionDecision) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            PermissionPromptHeader()
            subject
            PermissionPromptTarget(target: prompt.target)
            if let caption = prompt.caption {
                Text(caption)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            PermissionPromptFooter(decide: decide)
        }
        .padding(.top, ArgoSpacing.comfortable)
        .padding(.leading, ArgoSpacing.loose)
        .padding(.trailing, ArgoSpacing.base)
        .padding(.bottom, ArgoSpacing.base)
        // The rim is the state, on all four edges: this vessel is here because the agent stopped,
        // and a prompt that reads as the composer at rest is one a reader scrolls past.
        .argoFloatingGlass(
            in: RoundedRectangle(cornerRadius: ArgoRadius.popover),
            rim: argo.color.state.rim(argo.color.state.attention),
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Permission: \(prompt.toolName) \(prompt.subject)")
    }

    private var subject: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(prompt.toolName)
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.primary)
            Text(prompt.subject)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.secondary)
        }
    }
}

#Preview("Permission prompt — a command") {
    PermissionPrompt(prompt: PermissionSpecimen.command, decide: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Permission prompt — a path and its hunk") {
    PermissionPrompt(prompt: PermissionSpecimen.edit, decide: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Permission prompt — the Reduce Transparency fallback") {
    PermissionPrompt(prompt: PermissionSpecimen.command, decide: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoWithoutTransparency()
        .argoDeckSurface()
        .argoAppearance()
}
