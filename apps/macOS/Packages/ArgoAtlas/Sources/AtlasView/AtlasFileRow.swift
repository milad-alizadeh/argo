import ArgoDesign
import AtlasLayout
import SwiftUI

/// One file in the index beside the map (#1155, the approved design's `.frow`).
///
/// **Two lines, not one.** A basename is not an address — half a repository is called `index.ts` —
/// so the folder is the row's second line. It is clipped from its LEFT, because the last segment
/// of a folder is the telling one and a path clipped from the right loses exactly that.
///
/// A `Button`, because selecting a row is an action and a shape with a tap gesture is a control
/// that can look right and fire nothing (`rules/swift.md`).
struct AtlasFileRow: View {
    @Environment(\.argo) private var argo

    let entry: AtlasIndexEntry
    /// Whether this is the file the reader has open — the same fact the map traces, so a row and a
    /// volume can never claim different files.
    let isOpen: Bool
    let select: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: select) {
            HStack(alignment: .top, spacing: ArgoSpacing.base) {
                path
                value
            }
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.snug)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(RoundedRectangle(cornerRadius: ArgoRadius.control))
        }
        .buttonStyle(.plain)
        .background(ground, in: RoundedRectangle(cornerRadius: ArgoRadius.control))
        .onHover { isHovered = $0 }
        .help(entry.path)
        // The whole row, figure included: the path alone is what a sighted reader sees minus the
        // one number the row is also carrying.
        .accessibilityLabel(
            "\(entry.path), \(entry.value.map { $0.formatted(.measured) } ?? AtlasUnmeasured.alone)",
        )
        .accessibilityAddTraits(isOpen ? [.isSelected] : [])
    }

    /// The ground is the whole of the mark: selection is a ground in this app and never a rule
    /// down the leading edge, and hover is the quieter step of the same ladder.
    private var ground: Color {
        if isOpen {
            argo.color.interaction.selectionGround.color
        } else if isHovered {
            argo.color.surface.hover.color
        } else {
            .clear
        }
    }

    private var path: some View {
        // Flush: the two lines are ONE address broken over two clips, not a title and a subtitle,
        // and a gap between them reads as the second belonging to something else.
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            Text(entry.name)
                .argoText(ArgoTypography.machine)
                .foregroundStyle(argo.color.text.primary)
                .lineLimit(1)
                .truncationMode(.tail)
            if !entry.folder.isEmpty {
                Text(entry.folder)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.disabled)
                    .lineLimit(1)
                    // From the LEFT: the segment nearest the file is the one that says which
                    // `index.ts` this is.
                    .truncationMode(.head)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// What the file is worth on the channel the map is coloured by — the row's own reading of the
    /// same number the box beside it is painted from.
    private var value: some View {
        Text(entry.value.map { $0.formatted(.measured) } ?? AtlasUnmeasured.compact)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            .lineLimit(1)
            // On the name's baseline rather than the block's top: the two lines of the path are
            // one paragraph, and a number floating level with its cap reads as a superscript.
            .padding(.top, ArgoSpacing.hair)
    }
}
