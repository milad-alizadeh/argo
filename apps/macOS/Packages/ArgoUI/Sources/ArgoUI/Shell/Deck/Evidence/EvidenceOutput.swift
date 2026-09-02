import ArgoDesign
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
package struct EvidenceOutput: View {
    @Environment(\.argo) private var argo

    let output: OutputEvidence
    /// What the file this call named is written in, where it named a file at all. A read prints the
    /// file, so the panel draws it as the file — see `listing`, which decides whether the text
    /// actually is one.
    var language: EvidenceLanguage?
    /// Whether the call this answered failed. From the outcome, never from the characters.
    var hasFailed = false
    /// Whether this text IS the file at the step's address — see `FeedEvidence.Step`.
    var holdsTheFile = false
    /// Whether a markdown file is drawn as the document it is or as its own characters. Only
    /// markdown is ever asked in `prose` — every other language IS its source.
    package var reading: EvidenceReading = .source

    /// Read once per pass, not once per branch: this splits and re-parses the whole text, and a
    /// panel of a long file draws it on every layout (#474).
    package var body: some View {
        let listing = EvidenceListing.read(output.text)
        // The step says whether these characters ARE the file; the gutter does not, and a file Argo
        // read itself has none (#736). A FAILED call printed a message about the call, not a file.
        if holdsTheFile, let language, !hasFailed, !listing.lines.isEmpty {
            file(listing, in: language)
        } else {
            stream
        }
    }

    @ViewBuilder private func file(
        _ listing: EvidenceListing,
        in language: EvidenceLanguage,
    )
        -> some View {
        if language == .markdown, reading == .prose, listing.isRenderable {
            EvidenceDocument(text: listing.text)
        } else {
            EvidenceSource(listing: listing, language: language)
        }
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

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        output: OutputEvidence,
        language: EvidenceLanguage? = nil,
        hasFailed: Bool = false,
        holdsTheFile: Bool = false,
        reading: EvidenceReading = .source,
    ) {
        self.output = output
        self.language = language
        self.hasFailed = hasFailed
        self.holdsTheFile = holdsTheFile
        self.reading = reading
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
