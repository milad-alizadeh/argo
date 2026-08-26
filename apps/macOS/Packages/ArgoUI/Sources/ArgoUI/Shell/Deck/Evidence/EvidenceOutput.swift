import ArgoEngine
import SwiftUI

/// What a call printed, whole and verbatim.
///
/// No line numbers, because this is a stream and not a file — numbering it would claim an address
/// for lines the command never gave one.
///
/// Error output is told apart at the grain the RECORD tells it apart at: a transcript carries one
/// `is_error` on the whole answer and nothing per line, so a failed call's stream is marked whole,
/// by a rule down its edge. Never per line — `error:` appears in plenty of output that worked.
struct EvidenceOutput: View {
    @Environment(\.argo) private var argo

    let output: OutputEvidence
    /// What the file this call named is written in, where it named a file at all. A read prints the
    /// file, so the panel draws it as the file — see `listing`, which decides whether the text
    /// actually is one.
    var language: EvidenceLanguage?
    /// Whether the call this answered failed. From the outcome, never from the characters.
    var hasFailed = false
    /// Whether a markdown file is drawn as the document it is or as its own characters. Only
    /// markdown is ever asked in `prose` — every other language IS its source.
    var reading: EvidenceReading = .source

    var body: some View {
        if let language, !hasFailed, !listing.lines.isEmpty {
            file(language)
        } else {
            stream
        }
    }

    /// A file the call printed, drawn as the file. A language is only ever read off a PATH, so a
    /// step carrying one is a step whose subject is a file — the gutter is not what says so. A file
    /// Argo read itself has no gutter at all, and gating on one drew a `SKILL.md` as a stream of
    /// characters with its declared language dropped on the floor (#736).
    ///
    /// A FAILED call is never a file, whatever its text looks like: what it printed is a message
    /// about the call.
    @ViewBuilder private func file(_ language: EvidenceLanguage) -> some View {
        if language == .markdown, reading == .prose {
            EvidenceDocument(text: listing.text)
        } else {
            EvidenceSource(listing: listing, language: language)
        }
    }

    /// The file behind the text: the host's own numbered listing where it wrote one, and the
    /// characters exactly as they arrived where it did not.
    private var listing: EvidenceListing {
        EvidenceListing(output.text) ?? EvidenceListing(file: output.text)
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
