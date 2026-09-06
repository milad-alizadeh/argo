import ArgoAtoms
import ArgoDesign
import SwiftUI

/// How the map is laid out and which of its two views is drawn — the design's `AtlasArrangement`
/// section of the sidebar. Scoped to the View row; Group by (Folders and Domains) is #1158's row
/// of the same section.
///
/// The view pair lives here rather than over the map because it is not a camera: turning the city
/// is a gesture on the picture, and choosing between the city and the treemap is a choice about
/// what the picture IS, beside the channels that decide the rest of it.
public struct AtlasArrangement: View {
    @Environment(\.argo) private var argo

    @Binding private var isCity: Bool

    public init(isCity: Binding<Bool>) {
        _isCity = isCity
    }

    public var body: some View {
        AtlasSidebarSection("Arrangement") {
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
