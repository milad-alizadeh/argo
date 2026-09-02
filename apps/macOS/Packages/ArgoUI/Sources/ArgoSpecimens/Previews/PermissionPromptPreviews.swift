import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

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
