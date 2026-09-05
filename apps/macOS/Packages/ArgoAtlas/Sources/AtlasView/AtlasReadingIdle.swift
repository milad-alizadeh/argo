import ArgoDesign
import SwiftUI

/// The reading with nothing open in it (#1155).
///
/// The region is PERMANENT and keeps its height whether a file is open or not, which is what this
/// view is for: a panel that appeared and vanished with what was picked would move the list above
/// it on every click, and a reader choosing from a list they are also scrolling would lose their
/// place each time they chose.
///
/// It says the two ways in and the one way out, and nothing else. There is no chrome here
/// describing its own mechanism — the panel that replaces this one says what it is showing.
public struct AtlasReadingIdle: View {
    @Environment(\.argo) private var argo

    public init() {}

    public var body: some View {
        Text("Click a box on the map, or a row in the list, to open it here. Esc closes it again.")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.horizontal, ArgoSpacing.loose)
            .padding(.vertical, ArgoSpacing.comfortable)
            .accessibilityElement(children: .combine)
    }
}

#Preview("Atlas reading — nothing open") {
    AtlasReadingIdle()
        .frame(width: 356, height: 322)
        .argoAppearance()
}
