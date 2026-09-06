import ArgoDesign
import AtlasLayout
import SwiftUI

/// The Group by row's control: two words, one of which the map is tiled by (#1158) — the design's
/// own `.seg`.
///
/// WORDS rather than the pictures the View row takes. A folder tree and a set of inferred subjects
/// do not look different at a glance; what tells them apart is what they MEAN, so the control that
/// picks between them has to say it.
///
/// It goes quiet where the repository has no partition to re-tile on — a checkout with no history
/// to change together, or an inference that placed nothing. Dimmed rather than hidden: the reader
/// has to be able to see that the map HAS this second reading and that this repository could not
/// be given one, which a control that vanished would leave them guessing about.
struct AtlasGroupingControl: View {
    @Environment(\.argo) private var argo

    @Binding var grouping: AtlasGrouping

    /// Whether the Map carries a partition to tile on at all.
    let canGroupByDomain: Bool

    var body: some View {
        HStack(spacing: ArgoSpacing.flush) {
            half("Folders", .folders, corners: .leading)
            half("Domains", .domains, corners: .trailing)
        }
        .frame(width: Self.width)
        .opacity(canGroupByDomain ? 1 : Self.refused)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Group by")
    }

    /// One end of the segment. The halves share an edge, so each rounds only its own two corners
    /// and the pair reads as one control rather than as two buttons that happened to meet.
    private func half(
        _ title: String,
        _ mine: AtlasGrouping,
        corners: HorizontalEdge,
    )
        -> some View {
        let selected = grouping == mine
        let shape = Self.shape(corners)
        // The ground, the rim and the room round the word are all INSIDE the label, and the label
        // takes the shape as its contact area. A plain button is hit where its label is drawn, so
        // a frame hung on the outside would leave the coloured half of the segment pressing
        // nothing — a control that looks right and fires only over its four words.
        return Button {
            grouping = mine
        } label: {
            Text(title)
                // The KIND of line it is, never a rung picked here: a chosen half is a title and
                // an unchosen one is body, and the ink for each is named once beside the ramp
                // (#1250).
                .argoLine(ArgoTypography.control, selected ? .title : .body)
                .frame(maxWidth: .infinity, minHeight: Self.height)
                .background(shape.fill(fill(selected: selected)))
                .overlay(shape.stroke(edge(selected: selected), lineWidth: ArgoStroke.border))
                .contentShape(shape)
        }
        .buttonStyle(.plain)
        .disabled(mine == .domains && !canGroupByDomain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    /// The unselected half is the brand at its faintest — a ground words are read ON — and the
    /// selected one the rung above it. One ladder (`ArgoTint`), never two opacities typed here.
    private func fill(selected: Bool) -> ArgoColor {
        let accent = argo.color.interaction.accent
        return selected ? argo.color.state.muted(accent) : argo.color.state.wash(accent)
    }

    /// The selected half wears the brand as its edge as well as its ground, which is what carries
    /// the choice at a glance: the two grounds are four percent apart and the rim is half strength.
    private func edge(selected: Bool) -> ArgoColor {
        selected
            ? argo.color.state.rim(argo.color.interaction.accent)
            : argo.color.edge.strong
    }

    private static func shape(_ corners: HorizontalEdge) -> UnevenRoundedRectangle {
        let radius = ArgoRadius.control
        return UnevenRoundedRectangle(
            topLeadingRadius: corners == .leading ? radius : 0,
            bottomLeadingRadius: corners == .leading ? radius : 0,
            bottomTrailingRadius: corners == .trailing ? radius : 0,
            topTrailingRadius: corners == .trailing ? radius : 0,
        )
    }

    /// What the segment takes of the row — the design's own 138, which is what carries both words
    /// without either wrapping at the sidebar's narrowest.
    private static let width: CGFloat = 138

    /// A floor under the row's own, so the segment never decides the row's height: the row grows
    /// with the reader's text size and this grows inside it.
    private static let height = AtlasSidebarMeasure.rowHeight - ArgoSpacing.tight

    /// What a control the repository cannot offer is drawn at — the design's own `.srow.off`.
    private static let refused = 0.45
}

/// The row as the sidebar draws it, so the segment is seen at the width and beside the label it
/// really has rather than floating on its own.
private struct AtlasGroupingPreview: View {
    var grouping = AtlasGrouping.folders
    var canGroupByDomain = true

    @State private var chosen = AtlasGrouping.folders

    var body: some View {
        AtlasSidebarSection("Arrangement") {
            AtlasSidebarRow("Group by") {
                AtlasGroupingControl(
                    grouping: $chosen, canGroupByDomain: canGroupByDomain,
                )
            }
        }
        .frame(width: ArgoLayout.sidebarIdealWidth)
        .onAppear { chosen = grouping }
    }
}

#Preview("Atlas group by — the folder tree, which is where the room opens") {
    AtlasGroupingPreview().argoAppearance()
}

#Preview("Atlas group by — the inferred subjects") {
    AtlasGroupingPreview(grouping: .domains).argoAppearance()
}

// The repository that could not be given a partition: no history to change together, or an
// inference that placed nothing. The control stays, so the reader can see the reading exists.
#Preview("Atlas group by — nothing to group by") {
    AtlasGroupingPreview(canGroupByDomain: false).argoAppearance()
}
