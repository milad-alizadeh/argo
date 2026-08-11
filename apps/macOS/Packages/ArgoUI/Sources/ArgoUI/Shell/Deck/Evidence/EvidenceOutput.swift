import ArgoEngine
import SwiftUI

/// What a call printed, whole and verbatim.
///
/// No line numbers, because this is a stream and not a file — numbering it would claim an address
/// for lines the command never gave one.
///
/// Error output is told apart at the grain the RECORD tells it apart at, which is the whole
/// result: a transcript carries one `is_error` on the answer and nothing per line. So a failed
/// call's stream is marked as a stream, by a rule down its edge in the failure ink. Picking out
/// the lines inside it that look like errors would be Argo reading the output — the one thing a
/// panel that exists to show the record verbatim must not do — and `error:` is a word that
/// appears in plenty of output from commands that worked.
struct EvidenceOutput: View {
    @Environment(\.argo) private var argo

    let output: OutputEvidence
    /// What the file this call named is written in, where it named a file at all. A read prints the
    /// file, so the panel draws it as the file — see `listing`, which decides whether the text
    /// actually is one.
    var language: EvidenceLanguage?
    /// Whether the call this answered failed. From the outcome, never from the characters.
    var hasFailed = false

    var body: some View {
        if let listing, let language {
            EvidenceSource(listing: listing, language: language)
        } else {
            stream
        }
    }

    /// The read's own listing, or `nil` for everything that is not one.
    ///
    /// A FAILED call is never one, whatever its text looks like: what a failed read prints is a
    /// message about the call, and drawing an error under the file's grammar with a gutter beside
    /// it
    /// would present Argo's reading of the failure as the file the agent asked for.
    private var listing: EvidenceListing? {
        hasFailed ? nil : EvidenceListing(output.text)
    }

    private var stream: some View {
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
            .overlay(alignment: .leading) { failureRule }
            .accessibilityLabel(hasFailed ? "Error output" : "Output")
    }

    @ViewBuilder private var failureRule: some View {
        if hasFailed {
            Rectangle()
                .fill(argo.color.state.failure)
                .frame(width: ArgoFeedRow.ruleWidth)
        }
    }
}

#Preview("Evidence output — a build that failed") {
    EvidenceOutput(output: OutputEvidence(
        tier: .direct,
        text: "Exit code 65\n\nFeedCallLine.swift:88:7: error: cannot find 'diffAdded' in scope\n"
            + "        .foregroundStyle(diffAdded)\n                         ^~~~~~~~~\n"
            + "** BUILD FAILED **",
    ), hasFailed: true)
        .frame(width: 420, height: 240)
        .background(ArgoPalette.graphite.surface.sunken)
        .argoAppearance()
}
