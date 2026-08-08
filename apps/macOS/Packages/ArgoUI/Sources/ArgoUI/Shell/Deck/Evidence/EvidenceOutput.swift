import ArgoEngine
import SwiftUI

/// What a call printed, whole and verbatim.
///
/// No line numbers, because this is a stream and not a file — numbering it would claim an address
/// for lines the command never gave one. Nothing is highlighted either: which line matters is a
/// reading, and the row that opened this already made the only one Argo is entitled to.
struct EvidenceOutput: View {
    @Environment(\.argo) private var argo

    let output: OutputEvidence

    var body: some View {
        ScrollView([.vertical, .horizontal]) {
            Text(output.text)
                .argoText(ArgoTypography.machine)
                .foregroundStyle(argo.color.text.secondary)
                .textSelection(.enabled)
                .lineSpacing(ArgoFeedRow.machineLineSpacing)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(ArgoSpacing.comfortable)
        }
        // Output shorter than the panel sits at the TOP of it. A scroll view centres content it
        // does not have to scroll, which put a four-line build failure in the middle of an empty
        // pane — reading as a caption rather than as the beginning of a stream.
        .defaultScrollAnchor(.topLeading)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityLabel("Output")
    }
}

#Preview("Evidence output — a build that failed") {
    EvidenceOutput(output: OutputEvidence(
        tier: .direct,
        text: "Exit code 65\n\nFeedCallLine.swift:88:7: error: cannot find 'diffAdded' in scope\n"
            + "        .foregroundStyle(diffAdded)\n                         ^~~~~~~~~\n"
            + "** BUILD FAILED **",
    ))
    .frame(width: 420, height: 240)
    .background(ArgoPalette.graphite.surface.sunken)
    .argoAppearance()
}
