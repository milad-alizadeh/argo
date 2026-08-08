import ArgoEngine
import SwiftUI

/// What the panel is open ON: a mark for what kind of thing it was, the address the feed was
/// standing in for, and — for a subject that is not a file — the verb and how it went.
struct EvidenceHeader: View {
    @Environment(\.argo) private var argo

    let evidence: FeedEvidence
    /// How the panel is reading its patches, where there are two ways to read them. Bound rather
    /// than owned: the control lives up here and what it changes is drawn below the separator.
    @Binding var reading: EvidenceReading
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(evidence.symbol, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            if evidence.saysVerb {
                Text(evidence.verb)
                    .argoText(ArgoTypography.body)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            address
            Spacer(minLength: ArgoSpacing.snug)
            outcome
            readingToggle
            Button(action: dismiss) {
                ArgoGlyph(ArgoSymbol.dismiss, .inline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(argo.color.text.tertiary)
            .accessibilityLabel("Close evidence")
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.base)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(spoken)
    }

    /// The path from the cwd forward, on ONE line, cut from the FRONT where it does not fit. A path
    /// is identified by its right-hand end, so those are the characters to keep; wrapping it
    /// instead pushed the close control down and grew the header with the depth of whatever
    /// happened to be open.
    private var address: some View {
        Text(evidence.address)
            .argoMono(.body)
            .foregroundStyle(argo.color.text.primary)
            .textSelection(.enabled)
            .lineLimit(1)
            .truncationMode(.head)
            .help(evidence.address)
    }

    /// How it went, in a word, and only where there is anything to say. Success is silent here for
    /// the same reason it is silent on the row: the panel below is the outcome, at length, and
    /// `succeeded` over a stream of output the reader is already looking at says nothing twice.
    @ViewBuilder private var outcome: some View {
        if let spoken = evidence.ending.spoken {
            Text(spoken)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(
                    evidence.ending.hasFailed
                        ? argo.color.state.failure
                        : argo.color.text.tertiary,
                )
        }
    }

    /// The one control, and only for the one language that has two readings. It carries the mark of
    /// where it GOES rather than of where it is — a toggle showing its own state is a control the
    /// reader has to press to find out what it does.
    @ViewBuilder private var readingToggle: some View {
        if evidence.offersProse {
            Button { reading = reading == .prose ? .source : .prose } label: {
                ArgoGlyph(destination.symbol, .inline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(argo.color.text.tertiary)
            .help(destination.invitation)
            .accessibilityLabel(destination.invitation)
        }
    }

    private var destination: EvidenceReading {
        reading == .prose ? .source : .prose
    }

    /// The verb is spoken even where it is not drawn: a mark says "Swift file" to somebody looking
    /// at it and nothing at all to somebody listening.
    private var spoken: String {
        [evidence.verb, evidence.address, evidence.ending.spoken]
            .compactMap(\.self)
            .joined(separator: " ")
    }
}

/// The header's states, side by side: a file (mark, no verb, nothing to say about how it went), a
/// command that failed (verb drawn, outcome in the failure ink), and a markdown patch, which is
/// the only one carrying the reading control.
private struct EvidenceHeaderSpecimen: View {
    @State private var reading = EvidenceReading.source

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            EvidenceHeader(evidence: file, reading: $reading, dismiss: {})
            EvidenceHeader(evidence: command, reading: $reading, dismiss: {})
            EvidenceHeader(evidence: document, reading: $reading, dismiss: {})
        }
    }

    private var file: FeedEvidence {
        FeedEvidence(
            verb: "Edited", symbol: ArgoSymbol.swiftSource,
            address: "Sources/ArgoUI/Shell/Deck/Feed/FeedView.swift",
            language: .swift, ending: .succeeded, saysVerb: false, steps: [],
        )
    }

    private var command: FeedEvidence {
        FeedEvidence(
            verb: "Ran", symbol: ArgoSymbol.ran,
            address: "swift build --package-path Packages/ArgoUI",
            language: nil, ending: .failed, saysVerb: true, steps: [],
        )
    }

    private var document: FeedEvidence {
        FeedEvidence(
            verb: "Wrote", symbol: ArgoSymbol.proseSource,
            address: "docs/designs/feed-command-legibility-spec.md",
            language: .markdown, ending: .succeeded, saysVerb: false,
            steps: [FeedEvidence.Step(
                address: nil, language: nil,
                result: .diff(DiffEvidence(
                    tier: .direct, change: .create, destination: nil,
                    added: 1, removed: 0,
                    hunks: [DiffHunk(
                        oldStart: 0, newStart: 1,
                        lines: [DiffLine(side: .add, text: "# Feed command legibility")],
                    )],
                )),
            )],
        )
    }
}

#Preview("Evidence header — a file, a failed command, and a document") {
    EvidenceHeaderSpecimen()
        .frame(width: 480)
        .background(ArgoPalette.graphite.surface.sunken)
        .argoAppearance()
}

extension EvidenceReading {
    /// The mark for this reading, on the control that switches TO it.
    var symbol: String {
        switch self {
        case .source: ArgoSymbol.readAsSource
        case .prose: ArgoSymbol.readAsProse
        }
    }

    /// What pressing the control offers, for the tooltip and for the ear.
    var invitation: String {
        switch self {
        case .source: "Read the patch"
        case .prose: "Read as a document"
        }
    }
}
