import ArgoEngine
import SwiftUI

/// The target, verbatim and in full — mono, wrapping, scrolling past the ceiling. Selectable,
/// because a command worth judging is a command worth copying out.
struct PermissionPromptTarget: View {
    @Environment(\.argo) private var argo

    let target: PermissionRequest.Target

    @State private var contentHeight: CGFloat?

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(ArgoSpacing.base)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: {
                    contentHeight = $0
                }
        }
        .frame(height: drawnHeight)
        .background(argo.color.surface.sunken)
        .clipShape(RoundedRectangle(cornerRadius: ArgoRadius.control))
    }

    /// As tall as what is in it, and no taller than the ceiling.
    ///
    /// A `ScrollView` accepts whatever height it is proposed, so `maxHeight` on one is a FIXED
    /// height: a one-line command drew the full ceiling with three quarters of it dead black. The
    /// ceiling has to be spelled as the height itself, which means measuring the content — nil
    /// until the first pass, where the scroller's own ideal height stands in.
    private var drawnHeight: CGFloat? {
        contentHeight.map { min($0, ArgoComposerVessel.targetCeiling) }
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

/// One hunk of what an edit would write, in one neutral ink with the `−`/`+` markers telling the
/// sides apart.
///
/// The markers are drawn here, once — the domain keeps them off the text so no consumer strips
/// them back off. The ink stays neutral: this block is the VERBATIM target of a decision, and the
/// diffstat under it is where a side gets a colour.
private struct PermissionPromptHunk: View {
    @Environment(\.argo) private var argo

    let lines: [DiffLine]

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(Array(lines.enumerated()), id: \.offset) { line in
                Text(marker(for: line.element.side) + line.element.text)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.primary)
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
}
