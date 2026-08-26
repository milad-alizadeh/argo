import SwiftUI

/// A file a call printed, drawn as the file: the host's numbers in a gutter, the source beside them
/// under its own grammar.
///
/// The same anatomy a patch's hunk has, minus the wash — nothing here changed, so nothing takes a
/// side's ink.
///
/// The colours are decoration over a record. They arrive after the characters and may never arrive
/// at all; both cases draw the line plain, which is what an unrecognised file honestly gets.
struct EvidenceSource: View {
    let listing: EvidenceListing
    let language: EvidenceLanguage

    @State private var coloured: [AttributedString?] = []

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(Array(listing.lines.enumerated()), id: \.offset) { position, line in
                EvidenceSourceLine(
                    line: line,
                    coloured: position < coloured.count ? coloured[position] : nil,
                    hasGutter: listing.hasGutter,
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .accessibilityLabel("File contents")
        .task(id: highlightRequest) { await colour() }
    }

    /// What a highlight would be OF — the grammar and the characters, never the position. A stack
    /// recycles a row view by its offset, so keying on anything less than the text itself hands one
    /// file's colours to another file's words (`EvidenceDiff` learned this the same way).
    private var highlightRequest: String {
        "\(language.alias)\n\(listing.lines.map(\.text).joined(separator: "\n"))"
    }

    private func colour() async {
        coloured = await SyntaxHighlight.lines(
            of: listing.lines.map(\.text),
            in: language,
            colors: SyntaxTheme.colors,
        ) ?? []
    }
}

private struct EvidenceSourceLine: View {
    @Environment(\.argo) private var argo

    let line: EvidenceListing.Line
    let coloured: AttributedString?
    /// Whether the FILE has numbers, not this line — a column that comes and goes down the panel
    /// would move the words it is meant to be lining up.
    let hasGutter: Bool

    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.snug) {
            gutter
            // Wraps under its own words rather than back under the gutter, so a wrapped line still
            // reads as one line of the file with one number against it.
            words
                .argoMono(.body)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
    }

    /// The host's number for this line, where the host gave one. A file with no gutter is drawn
    /// without the column rather than with an empty one.
    @ViewBuilder private var gutter: some View {
        if hasGutter {
            Text(line.number.map(String.init) ?? "")
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.disabled)
                .frame(width: ArgoFeedRow.diffGutterWidth, alignment: .trailing)
        }
    }

    @ViewBuilder private var words: some View {
        if let coloured {
            Text(coloured)
        } else {
            Text(line.text).foregroundStyle(argo.color.text.secondary)
        }
    }
}

#Preview("Evidence source — a file a read printed, under its own grammar") {
    EvidenceListing(
        "    1→struct FeedPath: Equatable, Sendable {\n"
            + "    2→    let cwd: String?\n"
            + "    3→\n"
            + "    4→    func shortened(_ text: String) -> String {\n"
            + "    5→        text.replacingOccurrences(of: cwd ?? \"\", with: \"\")\n"
            + "    6→    }\n"
            + "    7→}\n",
    )
    .map { EvidenceSource(listing: $0, language: .swift) }
    .frame(width: 460, height: 240)
    .background(ArgoPalette.graphite.surface.sunken)
    .argoAppearance()
}
