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
        Text(output.text)
            .argoMono(.body)
            .foregroundStyle(argo.color.text.secondary)
            .textSelection(.enabled)
            .lineSpacing(ArgoFeedRow.machineLineSpacing)
            // Wraps rather than running off the edge. A stack in a scroll view sizes to its widest
            // child unless it is told to take the width it is given and grow downwards instead.
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.horizontal, ArgoSpacing.comfortable)
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
