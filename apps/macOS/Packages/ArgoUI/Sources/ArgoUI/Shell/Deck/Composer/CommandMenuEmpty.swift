import SwiftUI

/// The one line the `/` menu draws when nothing matches (design decision 8).
///
/// The surface STAYS, and the reader's line stays sendable: `/graphify` is a perfectly good thing
/// to say to an agent, and a menu that vanished would read as the composer refusing it. So the line
/// names what did not match and then says the line is still just text.
struct CommandMenuEmpty: View {
    @Environment(\.argo) private var argo

    /// What the reader typed after the `/`, said back to them so they can see the typo.
    let query: String

    var body: some View {
        (Text(Self.lead)
            + Text("/\(query)")
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

    static let lead = "No skill or command matches "
    /// The reassurance is half the line's job: nothing is broken and nothing is blocked.
    static let tail = ". Your line is still just text — ⏎ sends it as written."
}
