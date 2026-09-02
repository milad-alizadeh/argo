import ArgoAtoms
import ArgoDesign
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
    @Environment(\.argo) private var argo

    let listing: EvidenceListing
    let language: EvidenceLanguage

    var body: some View {
        SyntaxColoured(.source(lines: listing.lines.map(\.text), under: language)) { colouring in
            VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                ForEach(Array(listing.lines.enumerated()), id: \.offset) { position, line in
                    ArgoCodeLine(
                        text: line.text,
                        // Whether the FILE has numbers, not this line — see `ArgoCodeLine.Gutter`.
                        gutter: listing.hasGutter ? .number(line.number) : .unnumbered,
                        coloured: colouring[position],
                        ink: argo.color.text.secondary,
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .accessibilityLabel("File contents")
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
