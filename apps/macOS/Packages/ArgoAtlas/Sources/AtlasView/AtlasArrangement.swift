import ArgoAtoms
import ArgoDesign
import AtlasLayout
import SwiftUI

/// How the map is laid out and which of its two views is drawn — the design's `AtlasArrangement`
/// section of the sidebar: what the regions ARE (#1158), and which of the two readings of them is
/// drawn (#1152).
///
/// Both rows live here rather than over the map because neither is a camera: turning the city is a
/// gesture on the picture, and choosing what the picture IS — folders or subjects, standing or
/// flat — belongs beside the channels that decide the rest of it.
///
/// Group by comes FIRST, above View, because it is the larger question: it decides what the
/// regions of the map are, and View decides how those regions are drawn.
public struct AtlasArrangement: View {
    @Environment(\.argo) private var argo

    @Binding private var grouping: AtlasGrouping
    @Binding private var isCity: Bool

    /// Whether the Map carries an inference to re-tile on (#1158).
    private let canGroupByDomain: Bool

    public init(
        grouping: Binding<AtlasGrouping>,
        canGroupByDomain: Bool,
        isCity: Binding<Bool>,
    ) {
        _grouping = grouping
        self.canGroupByDomain = canGroupByDomain
        _isCity = isCity
    }

    public var body: some View {
        AtlasSidebarSection("Arrangement") {
            AtlasSidebarRow("Group by") {
                AtlasGroupingControl(
                    grouping: $grouping, canGroupByDomain: canGroupByDomain,
                )
            }
            AtlasSidebarRow("View") {
                // Each view is a picture of itself, which two words in a menu are not.
                ArgoIconButtonGroup {
                    button(title: "City", symbol: ArgoSymbol.atlasCity, selected: isCity) {
                        isCity = true
                    }
                    ArgoIconButtonRule()
                    button(
                        title: "Treemap", symbol: ArgoSymbol.atlasTreemap, selected: !isCity,
                    ) {
                        isCity = false
                    }
                }
            }
        }
    }

    private func button(
        title: String,
        symbol: String,
        selected: Bool,
        act: @escaping () -> Void,
    )
        -> some View {
        ArgoIconButton(
            symbol,
            voice: ArgoControlVoice(title),
            face: ArgoControlFace(
                ink: selected ? argo.color.text.primary : argo.color.text.tertiary,
            ),
            act: act,
        )
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
