import ArgoEngine
import SwiftUI

/// The patch one edit made, at the moment it made it.
///
/// Point-in-time and never re-read from disk: this is what that ONE call changed, so a later edit
/// to the same file does not touch it and the line numbers are the host's own. That is what
/// separates it from a branch-vs-base Diff, which is current by definition (CONTEXT.md, L3).
struct EvidenceDiff: View {
    @Environment(\.argo) private var argo

    let diff: DiffEvidence

    var body: some View {
        if diff.hunks.isEmpty {
            EvidenceUnreadablePatch(diff: diff)
        } else {
            ScrollView([.vertical, .horizontal]) {
                VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                    ForEach(Array(diff.hunks.enumerated()), id: \.offset) { _, hunk in
                        EvidenceHunk(hunk: hunk)
                    }
                }
                .padding(.vertical, ArgoSpacing.comfortable)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .defaultScrollAnchor(.topLeading)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .accessibilityLabel("Patch")
        }
    }
}

/// One contiguous run of changed lines, numbered as the host numbered it.
private struct EvidenceHunk: View {
    let hunk: DiffHunk

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(Array(numbered.enumerated()), id: \.offset) { _, line in
                EvidenceDiffLine(line: line.line, number: line.number)
            }
        }
    }

    /// A line's number in the file it ended up in. A removed line has none — it is not in that
    /// file — and the gutter is left empty rather than given the number of the line that replaced
    /// it, which is a different line.
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

    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.snug) {
            Text(number.map(String.init) ?? "")
                .argoText(ArgoTypography.machineCaption)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.disabled)
                .frame(width: ArgoFeedRow.diffGutterWidth, alignment: .trailing)
            Text(line.text)
                .argoText(ArgoTypography.machine)
                .foregroundStyle(ink)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .background(ground)
    }

    /// A wash for the changed sides and nothing for context, at the same strength a status chip
    /// takes — enough to find the run of changed lines down the panel, not enough to fight the
    /// characters sitting on it.
    private var ground: ArgoColor {
        switch line.side {
        case .add: argo.color.diff.wash(argo.color.diff.added)
        case .del: argo.color.diff.wash(argo.color.diff.removed)
        case .context: .transparent
        }
    }

    private var ink: ArgoColor {
        switch line.side {
        case .add, .del: argo.color.text.primary
        case .context: argo.color.text.tertiary
        }
    }
}

/// A mutation whose patch nothing could read — a binary file, a shape the reader does not parse.
/// It says so: the change HAPPENED, and a panel that drew an empty block would read as an edit
/// that changed nothing.
private struct EvidenceUnreadablePatch: View {
    @Environment(\.argo) private var argo

    let diff: DiffEvidence

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text("No patch was recorded for this change")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
            Text(diff.change.rawValue)
                .argoText(ArgoTypography.machineCaption)
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
