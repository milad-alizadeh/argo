import SwiftUI

/// The one line the `@` menu draws when no file matches (#687).
///
/// The surface STAYS and the line stays sendable, exactly as `CommandMenuEmpty` does for `/`: a
/// path Argo cannot find is still a fine thing to say to an agent, which may know where it went.
struct FileMenuEmpty: View {
    @Environment(\.argo) private var argo

    /// What the reader typed after the `@`, said back so they can see the typo.
    let query: String

    var body: some View {
        (Text(Self.lead)
            + Text("@\(query)")
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

    static let lead = "No file in this Workspace matches "
    /// The reassurance is half the line's job, for the reason it is on `CommandMenuEmpty`.
    static let tail = ". Your line is still just text — ⏎ sends it as written."
}
