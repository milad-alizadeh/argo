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
            PermissionPromptFooter(alwaysAllowLabel: prompt.alwaysAllowLabel, decide: decide)
        }
        .padding(.top, ArgoSpacing.comfortable)
        .padding(.leading, ArgoSpacing.loose)
        .padding(.trailing, ArgoSpacing.base)
        .padding(.bottom, ArgoSpacing.base)
        .argoFloatingGlass(in: RoundedRectangle(cornerRadius: ArgoRadius.popover))
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

/// Allow focused, `⏎` allows, `esc` denies — and the quieter third option on the trailing edge,
/// mapping to the standing baseline so a blessed tool pays no further round trip.
private struct PermissionPromptFooter: View {
    @Environment(\.argo) private var argo

    let alwaysAllowLabel: String
    let decide: (PermissionDecision) -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Button { decide(.allow) } label: { hinted("Allow", key: "⏎") }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            Button { decide(.deny) } label: { hinted("Deny", key: "esc") }
                .buttonStyle(.bordered)
                .tint(argo.color.state.failure.color)
                .keyboardShortcut(.cancelAction)
            Spacer()
            Button(alwaysAllowLabel) { decide(.allowAlways) }
                .buttonStyle(.borderless)
                .foregroundStyle(argo.color.text.secondary)
        }
        .controlSize(.small)
        .argoText(ArgoTypography.control)
    }

    private func hinted(_ verb: String, key: String) -> some View {
        HStack(spacing: ArgoSpacing.tight) {
            Text(verb)
            Text(key)
                .argoText(ArgoTypography.machineCaption)
                .opacity(ArgoOpacity.ghosted)
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
