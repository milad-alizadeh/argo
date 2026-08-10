import ArgoEngine
import SwiftUI

/// The target, verbatim and in full — mono, wrapping, scrolling past the ceiling. Selectable,
/// because a command worth judging is a command worth copying out.
struct PermissionPromptTarget: View {
    @Environment(\.argo) private var argo

    let target: PermissionRequest.Target

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(ArgoSpacing.base)
        }
        .frame(maxHeight: ArgoComposerVessel.targetCeiling)
        .background(argo.color.surface.sunken)
        .clipShape(RoundedRectangle(cornerRadius: ArgoRadius.control))
    }

    @ViewBuilder private var content: some View {
        switch target {
        case let .command(command):
            verbatim(command)
        case let .edit(path, hunks):
            VStack(alignment: .leading, spacing: ArgoSpacing.base) {
                verbatim(path)
                ForEach(Array(hunks.enumerated()), id: \.offset) { hunk in
                    PermissionPromptHunk(lines: hunk.element)
                }
            }
        case let .raw(input):
            verbatim(input)
        }
    }

    private func verbatim(_ text: String) -> some View {
        Text(text)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.primary)
            .textSelection(.enabled)
    }
}

/// One hunk of what an edit would write, each line under its own side's ink. The `−`/`+` markers
/// are drawn here, once — the domain keeps them off the text so no consumer strips them back off.
private struct PermissionPromptHunk: View {
    @Environment(\.argo) private var argo

    let lines: [DiffLine]

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(Array(lines.enumerated()), id: \.offset) { line in
                Text(marker(for: line.element.side) + line.element.text)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(ink(for: line.element.side))
                    .textSelection(.enabled)
            }
        }
    }

    private func marker(for side: DiffLineSide) -> String {
        switch side {
        case .add: "+  "
        case .del: "−  "
        case .context: "   "
        }
    }

    private func ink(for side: DiffLineSide) -> ArgoColor {
        switch side {
        case .add: argo.color.diff.added
        case .del: argo.color.diff.removed
        case .context: argo.color.text.secondary
        }
    }
}
