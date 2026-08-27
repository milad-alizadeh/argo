import SwiftUI

/// The one line a composer menu draws when nothing matches, whichever sigil opened it (design
/// decision 8, #685, #687).
///
/// The surface STAYS, and the reader's line stays sendable: `/graphify` is a perfectly good thing
/// to say to an agent, and a path Argo cannot find is one the agent may know where to find. A menu
/// that vanished would read as the composer refusing the line. So the line names what did not
/// match, and then says the line is still just text.
struct ComposerMenuZeroLine: View {
    @Environment(\.argo) private var argo

    /// What the reader typed after the sigil, said back to them so they can see the typo.
    let query: String
    let sigil: ComposerMenu.Sigil

    var body: some View {
        (Text(sigil.nothingMatched)
            + Text("\(sigil.mark)\(query)")
            .foregroundStyle(argo.color.text.primary.color)
            .fontWeight(.semibold)
            + Text(Self.tail))
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.tertiary)
            .lineLimit(1)
            .truncationMode(.middle)
            .padding(.horizontal, ArgoSpacing.base)
            .frame(height: ArgoComposerVessel.commandRowHeight, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
    }

    /// The reassurance is half the line's job: nothing is broken and nothing is blocked.
    static let tail = ". Your line is still just text — ⏎ sends it as written."
}
