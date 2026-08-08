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
    /// What the file is written in, or `nil` for a path whose extension Argo does not know. The
    /// patch is then drawn in one ink, which is what an unrecognised file honestly gets.
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
/// The AFTER side, which is the whole of the file for something the agent just wrote. A removed
/// line is not in that document any more and a rendered page has nowhere to put one — that is the
/// honest cost of this reading, and the reason the patch stays one control away rather than being
/// replaced by it.
private struct EvidenceHunkProse: View {
    let hunk: DiffHunk

    var body: some View {
        FeedMarkdown(text: document)
            .textSelection(.enabled)
            .padding(.horizontal, ArgoSpacing.comfortable)
            .accessibilityLabel("Document")
    }

    private var document: String {
        hunk.lines.filter { $0.side != .del }.map(\.text).joined(separator: "\n")
    }
}

/// One contiguous run of changed lines, numbered as the host numbered it.
private struct EvidenceHunk: View {
    let hunk: DiffHunk
    let language: EvidenceLanguage?

    /// The hunk's lines, coloured. Empty until the highlighter answers and empty again if it
    /// cannot: the patch draws PLAIN in both cases rather than waiting on a colour, so the record
    /// is on screen from the first frame and the grammar catches up to it.
    @State private var coloured: [AttributedString?] = []

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(Array(numbered.enumerated()), id: \.offset) { position, line in
                EvidenceDiffLine(
                    line: line.line,
                    number: line.number,
                    coloured: position < coloured.count ? coloured[position] : nil,
                )
            }
        }
        .task(id: highlightRequest) { await colour() }
    }

    /// What a highlight would be OF: the grammar, and the characters themselves.
    ///
    /// The TEXT and not the hunk's position, which is the whole point. A lazy stack recycles a row
    /// view by its offset, so a second hunk that matched on language, start line and line count
    /// inherited the first one's `coloured` array — colours drawn over different characters, and no
    /// way for a reader to know. Two hunks with the same key are now two hunks with the same words.
    private var highlightRequest: String {
        "\(language?.alias ?? "")\n\(hunk.lines.map(\.text).joined(separator: "\n"))"
    }

    private func colour() async {
        guard let language else {
            coloured = []
            return
        }
        coloured = await SyntaxPatch.lines(
            of: hunk.lines,
            in: language,
            colors: SyntaxTheme.colors,
        )
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
    /// This line under the grammar, where the highlighter reached it. `nil` is not a failure state
    /// to render — it is the line before the colours arrive, and after they could not.
    let coloured: AttributedString?

    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.snug) {
            Text(number.map(String.init) ?? "")
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.disabled)
                .frame(width: ArgoFeedRow.diffGutterWidth, alignment: .trailing)
            // Wraps under its own words rather than back under the gutter, so a wrapped line still
            // reads as one line of the file with one number against it.
            words
                .argoMono(.body)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .background(ground)
    }

    /// The grammar's inks where it read the line, and the patch's own where it did not.
    ///
    /// EVERY line once the colours arrive, context included: which side a line is on is said by
    /// the wash under it, and colouring only the changed lines left the context around them
    /// reading as a different file. What the patch still owns is the uncoloured case — a context
    /// line with no grammar behind it stays quieter than a changed one.
    @ViewBuilder private var words: some View {
        if let coloured {
            Text(coloured)
        } else {
            Text(line.text).foregroundStyle(ink)
        }
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
