import ArgoDesign
import SwiftUI

/// The field a reader finds a file in (#1155, the approved design's `AtlasFind`).
///
/// A real field standing at the top of the rail, never an icon that becomes one: finding a file is
/// the first thing a reader does with a map of a repository they do not know, and a control that
/// has to be discovered before it can be used is a control that is not there.
///
/// **It sits above the list rather than inside it.** The list is rebuilt whenever what it holds
/// changes; a field inside it would lose the reader's focus, and their text with it, between one
/// keystroke and the next — which is the design's own reason for the same split.
public struct AtlasFind: View {
    @Environment(\.argo) private var argo

    @Binding private var query: String

    public init(query: Binding<String>) {
        _query = query
    }

    public var body: some View {
        TextField(Self.placeholder, text: $query)
            .textFieldStyle(.plain)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .padding(.horizontal, ArgoSpacing.comfortable)
            .padding(.vertical, ArgoSpacing.base)
            .background(argo.color.surface.hover.color, in: shape)
            .overlay {
                shape.strokeBorder(argo.color.edge.subtle.color, lineWidth: ArgoStroke.border)
            }
            .accessibilityLabel(Self.placeholder)
    }

    /// What the field asks for, and the whole of what it can answer: this list is files, so the
    /// design's own "file, folder or domain" would promise two things nothing here finds.
    private static let placeholder = "Find a file"

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
    }
}

#Preview("Atlas find — nothing typed") {
    @Previewable @State var query = ""

    AtlasFind(query: $query)
        .frame(width: 324)
        .padding(ArgoSpacing.loose)
        .argoAppearance()
}

#Preview("Atlas find — a question typed") {
    @Previewable @State var query = "atlas swift"

    AtlasFind(query: $query)
        .frame(width: 324)
        .padding(ArgoSpacing.loose)
        .argoAppearance()
}
