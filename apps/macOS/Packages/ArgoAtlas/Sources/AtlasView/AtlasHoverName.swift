import ArgoDesign
import SwiftUI

/// THE NAME BAR. What the file under the pointer is called, said on a standing surface over the
/// map (#1153, the approved design's `AtlasHoverName`).
///
/// A five-pixel cell cannot carry a name, and a chip laid over the box would say the name belongs
/// to a layer above the map — so the name goes to a strip of the stage instead. The STAGE's own
/// strip and never the reading beside it: a pointer passing over the map must not rewrite what
/// somebody is reading, which is what a click is for.
///
/// It says the last folder or two before the file in the quiet ramp and the file's own name in the
/// weight beside it, because a repository has thirty `README.md` and the question a hover answers
/// is which one.
public struct AtlasHoverName: View {
    @Environment(\.argo) private var argo

    /// The Plot's path — the join key, exactly as the Map holds it (`docs/domain/atlas.md`).
    public let path: String

    public init(path: String) {
        self.path = path
    }

    /// How much of the path is said in front of the name. Two segments, which is what fits a strip
    /// that must not become a second reading panel: enough to tell two `README.md` apart, and not
    /// a breadcrumb of eleven levels of nesting.
    private static let leadingFolders = 2

    /// How wide the strip may run before its own path elides. A share of the map rather than a
    /// width, because the map is whatever the room gave it — the design's own 52%.
    private static let share: CGFloat = 0.52

    public var body: some View {
        HStack(spacing: ArgoSpacing.flush) {
            if let lead {
                Text(lead)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            Text(name)
                .argoText(ArgoTypography.captionEmphasis)
                .foregroundStyle(argo.color.text.primary)
        }
        .lineLimit(1)
        .truncationMode(.tail)
        .padding(.vertical, ArgoSpacing.tight)
        .padding(.horizontal, ArgoSpacing.base)
        // Opaque, where the design blurs what is behind it. Not a shortcut: the map is an
        // `MTKView`, and SwiftUI's own glass samples the layer tree rather than a Metal drawable —
        // a blur here would sample the WINDOW behind the city and read as a hole in it. The colour
        // is the design's own `--overlay` either way.
        .background(argo.color.surface.overlay, in: .rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.strong, lineWidth: ArgoStroke.border)
        }
        // The map is under it and the pointer is what drives it: a strip that took the click would
        // put a hole in the city exactly where a reader is pointing.
        .allowsHitTesting(false)
        .accessibilityElement()
        .accessibilityLabel(path)
    }

    private var segments: [Substring] {
        path.split(separator: "/")
    }

    private var name: String {
        String(segments.last ?? "")
    }

    /// The folders in front of the name, with the separator that says they are folders — or
    /// nothing at all for a file at the root, where a bare `/` would be a claim about a folder
    /// nobody has.
    private var lead: String? {
        let ahead = segments.dropLast().suffix(Self.leadingFolders)
        guard !ahead.isEmpty else { return nil }
        return ahead.joined(separator: "/") + "/"
    }
}

/// How wide the name bar may run inside a map of one width.
public extension AtlasHoverName {
    static func width(over map: CGFloat) -> CGFloat {
        map * share
    }
}

#Preview("Atlas hover name — a file inside folders") {
    AtlasHoverName(path: "argo/apps/macOS/Packages/ArgoAtlas/Sources/AtlasView/AtlasView.swift")
        .frame(maxWidth: 320)
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Atlas hover name — a file at the root") {
    AtlasHoverName(path: "README.md")
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}
