import ArgoEngine
import SwiftUI

/// The patch one edit made, at the moment it made it.
///
/// Point-in-time and never re-read from disk: this is what that ONE call changed, so a later edit
/// to the same file does not touch it and the line numbers are the host's own — unlike a
/// branch-vs-base Diff, which is current by definition (CONTEXT.md, L3).
struct EvidenceDiff: View {
    let diff: DiffEvidence
    /// What the file is written in, or `nil` for a path whose extension Argo does not know — the
    /// patch is then drawn in one ink.
    var language: EvidenceLanguage?
    /// Whether the patch is drawn as a patch or as the document it made. Only markdown is ever
    /// asked in `prose`; every other language IS its source.
    var reading: EvidenceReading = .source

    var body: some View {
        if diff.hunks.isEmpty {
            EvidenceUnreadablePatch(diff: diff)
        } else {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                ForEach(Array(diff.hunks.enumerated()), id: \.offset) { _, hunk in
                    switch reading {
                    case .source: EvidenceHunk(hunk: hunk, language: language)
                    case .prose: EvidenceHunkProse(hunk: hunk)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .accessibilityLabel("Patch")
        }
    }
}

/// A markdown hunk read as the document it made, rather than as the patch that made it.
///
/// The AFTER side only: a removed line is not in that document any more and a rendered page has
/// nowhere to put one, which is why the patch stays one control away.
private struct EvidenceHunkProse: View {
    let hunk: DiffHunk

    var body: some View {
        EvidenceDocument(text: document)
    }

    private var document: String {
        hunk.lines.filter { $0.side != .del }.map(\.text).joined(separator: "\n")
    }
}

/// One contiguous run of changed lines, numbered as the host numbered it.
private struct EvidenceHunk: View {
    let hunk: DiffHunk
    let language: EvidenceLanguage?

    var body: some View {
        SyntaxColoured(.patch(lines: hunk.lines, under: language)) { colouring in
            VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                ForEach(Array(numbered.enumerated()), id: \.offset) { position, line in
                    EvidenceDiffLine(
                        line: line.line,
                        number: line.number,
                        coloured: colouring[position],
                    )
                }
            }
        }
    }

    /// A line's number in the file it ended up in. A removed line has none, and the gutter is left
    /// empty rather than given the number of the line that replaced it.
    private var numbered: [(line: DiffLine, number: Int?)] {
        var next = hunk.newStart
        return hunk.lines.map { line in
            guard line.side != .del else { return (line, nil) }
            defer { next += 1 }
            return (line, next)
        }
    }
}

private struct EvidenceDiffLine: View {
    @Environment(\.argo) private var argo

    let line: DiffLine
    let number: Int?
    let coloured: AttributedString?

    var body: some View {
        ArgoCodeLine(text: line.text, gutter: .number(number), coloured: coloured, ink: ink)
            .background(ground)
    }

    /// A wash for the changed sides and nothing for context, at the same strength a status chip
    /// takes.
    private var ground: ArgoColor {
        switch line.side {
        case .add: argo.color.diff.wash(argo.color.diff.added)
        case .del: argo.color.diff.wash(argo.color.diff.removed)
        case .context: .transparent
        }
    }

    /// The patch's own ink, for the characters the grammar did not reach. Dimmer for context: which
    /// side a line is on is said by the wash under it, and a changed line reads at full strength.
    private var ink: ArgoColor {
        switch line.side {
        case .add, .del: argo.color.text.primary
        case .context: argo.color.text.tertiary
        }
    }
}

/// A mutation whose patch nothing could read — a binary file, a shape the reader does not parse.
/// It says so, because an empty block would read as an edit that changed nothing.
private struct EvidenceUnreadablePatch: View {
    @Environment(\.argo) private var argo

    let diff: DiffEvidence

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text("No patch was recorded for this change")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
            Text(diff.change.rawValue)
                .argoMono(.body)
                .foregroundStyle(argo.color.text.disabled)
        }
        .padding(ArgoSpacing.comfortable)
    }
}

#Preview("Evidence patch — a modify, with its context") {
    EvidenceDiff(diff: DiffEvidence(
        tier: .direct,
        change: .modify,
        destination: nil,
        added: 1,
        removed: 1,
        hunks: [DiffHunk(oldStart: 86, newStart: 86, lines: [
            DiffLine(side: .context, text: "    private var outcome: some View {"),
            DiffLine(side: .del, text: "        .foregroundStyle(diffAdded)"),
            DiffLine(side: .add, text: "        .foregroundStyle(argo.color.diff.added)"),
            DiffLine(side: .context, text: "    }"),
        ])],
    ))
    .frame(width: 460, height: 240)
    .background(ArgoPalette.graphite.surface.sunken)
    .argoAppearance()
}

#Preview("Evidence patch — a change whose patch could not be read") {
    EvidenceDiff(diff: DiffEvidence(
        tier: .direct,
        change: .modify,
        destination: nil,
        added: 0,
        removed: 0,
        hunks: [],
    ))
    .frame(width: 460, height: 160)
    .background(ArgoPalette.graphite.surface.sunken)
    .argoAppearance()
}
