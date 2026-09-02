import ArgoDesign
import SwiftUI

/// One line of code as its file has it: the host's number in a gutter, the characters beside it
/// under the grammar where the grammar reached them.
public struct ArgoCodeLine: View {
    /// Whether the FILE numbers its lines, and this line's number where it does.
    public enum Gutter: Equatable {
        /// A file carrying no numbers. Drawn without the column, because a column that came and
        /// went down the panel would move the words it is there to line up.
        case unnumbered
        /// A numbered file, and how wide the column is. No number is a line the numbering does
        /// not reach — a removed line is not in the file the gutter counts. The width comes from
        /// the caller because it is a MEASURE: how wide four digits sit is the reading surface's
        /// property, not the contract's (rules/design-system.md).
        case number(Int?, width: CGFloat)
    }

    @Environment(\.argo) private var argo

    let text: String
    let gutter: Gutter
    /// The line before the colours arrive, and after they could not, is nothing here.
    let coloured: AttributedString?
    /// The ink for the characters the grammar did not reach. The colours carry their own.
    let ink: ArgoColor

    public init(text: String, gutter: Gutter, coloured: AttributedString?, ink: ArgoColor) {
        self.text = text
        self.gutter = gutter
        self.coloured = coloured
        self.ink = ink
    }

    public var body: some View {
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
        if case let .number(number, width) = gutter {
            Text(number.map(String.init) ?? "")
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.disabled)
                .frame(width: width, alignment: .trailing)
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

/// The width the feed hands the gutter, restated here because a preview is its own caller.
private let previewGutter: CGFloat = 32

/// A run with real inks in it, so the coloured branch is on screen beside the plain one.
private func previewColoured(_ head: String, _ tail: String) -> AttributedString {
    var keyword = AttributedString(head)
    keyword.foregroundColor = ArgoPalette.graphite.diff.added.color
    var value = AttributedString(tail)
    value.foregroundColor = ArgoPalette.graphite.interaction.accentBright.color
    return keyword + value
}

#Preview("Code line — every state the surfaces draw, including a line long enough to wrap") {
    VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
        ArgoCodeLine(
            text: "    return nil",
            gutter: .number(41, width: previewGutter),
            coloured: previewColoured("    return ", "nil"),
            ink: ArgoPalette.graphite.text.secondary,
        )
        ArgoCodeLine(
            text: "    let colours = coloured[position]",
            gutter: .number(nil, width: previewGutter),
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
        ArgoCodeLine(
            text: "        return await SyntaxHighlight.lines(of: lines, in: language, "
                + "colors: SyntaxTheme.colors) ?? []",
            gutter: .number(42, width: previewGutter),
            coloured: nil,
            ink: ArgoPalette.graphite.text.secondary,
        )
    }
    .padding(.vertical, ArgoSpacing.base)
    .frame(width: 460)
    .background(ArgoPalette.graphite.surface.sunken)
    .argoAppearance()
}
