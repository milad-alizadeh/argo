import SwiftUI

/// One line of code as its file has it: the host's number in a gutter, the characters beside it
/// under the grammar where the grammar reached them.
///
/// One view because a source panel and a patch's hunk are the same anatomy. The gutter's width and
/// the way a long line wraps are decided here, once; the ink for uncoloured characters and the
/// ground under them are the surface's own and stay outside.
struct ArgoCodeLine: View {
    /// Whether the FILE numbers its lines, and this line's number where it does.
    enum Gutter: Equatable {
        /// A file carrying no numbers. The column is not drawn at all rather than drawn empty — a
        /// column that came and went down the panel would move the words it is there to line up.
        case unnumbered
        /// A numbered file. No number is a line the numbering does not reach: a removed line is not
        /// in the file the gutter counts, and is left blank rather than given its successor's.
        case number(Int?)
    }

    @Environment(\.argo) private var argo

    let text: String
    let gutter: Gutter
    /// This line under the grammar. Nothing is not a failure state to render — it is the line
    /// before the colours arrive, and after they could not.
    let coloured: AttributedString?
    /// The ink the characters take where the grammar did not reach them. The colours carry their
    /// own.
    let ink: ArgoColor

    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.snug) {
            number
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

    @ViewBuilder private var number: some View {
        if case let .number(number) = gutter {
            Text(number.map(String.init) ?? "")
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
            Text(text).foregroundStyle(ink)
        }
    }
}

#Preview("Code line — numbered, unnumbered, and a line the numbering does not reach") {
    VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
        ArgoCodeLine(
            text: "    let colours = await SyntaxColouring(of: request)",
            gutter: .number(41),
            coloured: nil,
            ink: ArgoPalette.graphite.text.secondary,
        )
        ArgoCodeLine(
            text: "    let colours = coloured[position]",
            gutter: .number(nil),
            coloured: nil,
            ink: ArgoPalette.graphite.text.primary,
        )
        .background(ArgoPalette.graphite.diff.wash(ArgoPalette.graphite.diff.removed))
        ArgoCodeLine(
            text: "# A file Argo read, which nothing numbered",
            gutter: .unnumbered,
            coloured: nil,
            ink: ArgoPalette.graphite.text.secondary,
        )
    }
    .padding(.vertical, ArgoSpacing.base)
    .frame(width: 460)
    .background(ArgoPalette.graphite.surface.sunken)
    .argoAppearance()
}
